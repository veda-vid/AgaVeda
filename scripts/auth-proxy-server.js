const http = require('http');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

global.WebSocket = require('ws');

const envPath = path.join(process.cwd(), '.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\n/).filter(Boolean).map((line) => {
    const [k, ...rest] = line.split('=');
    return [k, rest.join('=').replace(/^['"]|['"]$/g, '')];
  })
);

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase env vars for auth proxy server.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.url === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/auth/signup') {
    try {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const fullName = String(body.fullName || '').trim();
      const username = String(body.username || '').trim();
      const phone = String(body.phone || '').trim();
      const role = String(body.role || 'buyer');

      if (!email || !password) {
        sendJson(res, 400, { error: 'Email and password are required.' });
        return;
      }

      const userMetadata = {
        full_name: fullName,
        username,
        phone,
        role,
      };

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (error) {
        const message = error?.message || '';
        if (!/already|exists|duplicate/i.test(message)) {
          throw error;
        }
      }

      sendJson(res, 200, { ok: true, email, confirmed: true, created: !error, userId: data?.user?.id });
    } catch (error) {
      console.error('Signup proxy error', error);
      sendJson(res, 500, { error: error.message || 'Failed to create account.' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found.' });
});

const port = 3001;
server.listen(port, () => {
  console.log(`Auth proxy server listening on http://localhost:${port}`);
});
