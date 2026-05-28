-- GSS Workforce — Supabase schema
-- Run this in Supabase SQL Editor. Safe to re-run (drops + recreates).

-- ============================================================
-- Tables
-- ============================================================

drop table if exists generated_docs cascade;
drop table if exists shifts_queue   cascade;
drop table if exists applications   cascade;
drop table if exists visit_logs     cascade;
drop table if exists time_off       cascade;

create table time_off (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id) on delete set null,
  employee    text not null,
  site        text,
  start_date  date,
  end_date    date,
  reason      text,
  notes       text,
  status      text default 'pending'  -- pending | approved | denied
);

create table visit_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id) on delete set null,
  supervisor  text not null,
  site        text not null,
  visit_date  date,
  visit_time  time,
  officer     text,
  in_uniform  boolean,
  observations text,
  action_items text
);

create table applications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  first_name  text,
  last_name   text,
  phone       text,
  email       text,
  city        text,
  position    text,
  experience  text,
  availability text,
  status      text default 'new'  -- new | reviewing | hired | rejected
);

create table shifts_queue (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id) on delete set null,
  employee    text not null,
  site        text,
  shift_date  date not null,
  start_time  time,
  end_time    time,
  notes       text,
  pushed_to_humanity boolean default false,
  humanity_shift_id  text
);

create table generated_docs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id) on delete set null,
  doc_type    text not null,  -- onboarding | writeup | cap | termination
  employee    text,
  body        text not null,
  metadata    jsonb default '{}'::jsonb
);

create index time_off_created_idx     on time_off(created_at desc);
create index visit_logs_created_idx   on visit_logs(created_at desc);
create index applications_created_idx on applications(created_at desc);
create index shifts_queue_created_idx on shifts_queue(created_at desc);
create index generated_docs_idx       on generated_docs(created_at desc);

-- ============================================================
-- Row Level Security
--   Single-admin mode: only authenticated users can read or write.
--   Applications table also allows anonymous INSERT (for a public
--   careers form later) — comment out if you don't want that.
-- ============================================================

alter table time_off       enable row level security;
alter table visit_logs     enable row level security;
alter table applications   enable row level security;
alter table shifts_queue   enable row level security;
alter table generated_docs enable row level security;

-- Authenticated users: full access
create policy "auth full" on time_off       for all to authenticated using (true) with check (true);
create policy "auth full" on visit_logs     for all to authenticated using (true) with check (true);
create policy "auth full" on applications   for all to authenticated using (true) with check (true);
create policy "auth full" on shifts_queue   for all to authenticated using (true) with check (true);
create policy "auth full" on generated_docs for all to authenticated using (true) with check (true);

-- Anonymous: can submit a job application, nothing else
create policy "anon insert" on applications for insert to anon with check (true);
