-- Add reposts table for tracking user reposts
create table if not exists public.reposts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

-- Add RLS policies
alter table public.reposts enable row level security;

-- Allow users to view all reposts
create policy "Reposts are viewable by everyone"
  on public.reposts for select
  using (true);

-- Allow authenticated users to insert their own reposts
create policy "Users can insert their own reposts"
  on public.reposts for insert
  with check (auth.uid() = user_id);

-- Allow users to delete their own reposts
create policy "Users can delete their own reposts"
  on public.reposts for delete
  using (auth.uid() = user_id);

-- Add indexes for better performance
create index if not exists idx_reposts_user_id on public.reposts(user_id);
create index if not exists idx_reposts_post_id on public.reposts(post_id);
create index if not exists idx_reposts_shop_id on public.reposts(shop_id);
create index if not exists idx_reposts_created_at on public.reposts(created_at desc);
