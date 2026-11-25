-- UrbanFix Supabase Schema
-- Run this script once in your Supabase Dashboard -> SQL Editor

create table if not exists public.urbanfix_users (
  id text primary key,
  role text not null check (role in ('customer', 'provider')),
  auth_method text not null check (auth_method in ('gmail', 'phone')),
  identifier text not null,
  user_email text generated always as (case when auth_method = 'gmail' then identifier else null end) stored,
  name text not null,
  password_hash text not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (role, auth_method, identifier)
);

alter table public.urbanfix_users
  add column if not exists user_email text
  generated always as (case when auth_method = 'gmail' then identifier else null end) stored;

create index if not exists idx_urbanfix_users_role_lookup
  on public.urbanfix_users (role, auth_method, identifier);

create table if not exists public.urbanfix_bookings (
  id text primary key,
  customer_id text not null,
  customer_name text not null,
  customer_contact text not null,
  location jsonb not null,
  service_category text not null,
  service_category_label text not null,
  selected_problems jsonb not null default '[]'::jsonb,
  diagnosis jsonb not null,
  media_preview_data_url text,
  media_type text,
  customer_notes text,
  scheduled_slot text not null,
  payment_method text not null,
  payment_status text not null,
  status text not null,
  assigned_provider_id text,
  assigned_provider_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_urbanfix_bookings_customer_id
  on public.urbanfix_bookings (customer_id);

create index if not exists idx_urbanfix_bookings_created_at
  on public.urbanfix_bookings (created_at desc);

-- Enable Row Level Security so anonymous browser keys cannot read or mutate tables directly.
-- The UrbanFix Express backend accesses these tables server-side with SUPABASE_SERVICE_ROLE_KEY.
alter table public.urbanfix_users enable row level security;
alter table public.urbanfix_bookings enable row level security;

grant usage on schema public to service_role;
grant all privileges on table public.urbanfix_users to service_role;
grant all privileges on table public.urbanfix_bookings to service_role;
