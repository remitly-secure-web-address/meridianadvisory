-- Run this once in the Supabase SQL editor.
-- The service role used by the server bypasses these policies.
-- The public anon key has no access.

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  received_at timestamptz not null,
  received_label text not null,
  full_name text not null,
  email text not null,
  city text not null default '',
  country text not null default '',
  store_url text not null,
  niche text not null default '',
  product text not null default '',
  year_created text not null default '',
  shopify_plan text not null default '',
  first_sale text not null default '',
  first_sale_date text not null default '',
  last_sale text not null default '',
  last_sale_date text not null default '',
  marketing text[] not null default '{}',
  expert text not null default '',
  nature text not null,
  category text not null,
  summary text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists inquiries_email_created_idx
  on public.inquiries (email, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  reference text,
  direction text not null,
  resend_id text,
  from_email text,
  to_email text,
  subject text,
  body text,
  created_at timestamptz not null default now()
);

create index if not exists messages_reference_idx
  on public.messages (reference);

alter table public.inquiries enable row level security;
alter table public.messages enable row level security;
