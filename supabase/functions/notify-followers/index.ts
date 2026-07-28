// supabase/functions/notify-followers/index.ts
// Deploy with: supabase functions deploy notify-followers

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  try {
    const { shop_id, post_id, title, body } = await req.json();

    // Get all followers of this shop who have push tokens
    const { data: followers } = await supabase
      .from('shop_followers')
      .select('profiles!inner(id, push_token)')
      .eq('shop_id', shop_id)
      .not('profiles.push_token', 'is', null);

    if (!followers?.length) return new Response('No followers', { status: 200 });

    const tokens = followers
      .map((f: any) => f.profiles?.push_token)
      .filter(Boolean);

    // Send via Expo Push API (free, no account needed)
    const messages = tokens.map((token: string) => ({
      to: token,
      title,
      body,
      data: { post_id, shop_id },
      sound: 'default',
    }));

    // Batch send (Expo allows 100 per request)
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
    }

    // Save notifications to DB for in-app inbox
    const notifications = followers.map((f: any) => ({
      user_id:    f.profiles.id,
      type:       'new_product',
      title,
      body,
      data:       { post_id, shop_id },
      is_read:    false,
    }));

    await supabase.from('notifications').insert(notifications);

    return new Response(JSON.stringify({ sent: tokens.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
