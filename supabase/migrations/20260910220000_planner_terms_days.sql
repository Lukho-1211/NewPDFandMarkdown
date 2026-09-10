-- Applied remotely via Supabase MCP as planner_terms_days.
-- Shared class planner: teachers/admins write; signed-in users read.

create table if not exists public.planner_terms (
  number smallint primary key check (number between 1 and 4),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.planner_days (
  term smallint not null references public.planner_terms (number) on delete cascade,
  week smallint not null check (week between 1 and 13),
  day text not null check (day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  file_name text not null,
  markdown text not null,
  pdf_path text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (term, week, day)
);

create index if not exists planner_days_term_week_idx
  on public.planner_days (term, week);

alter table public.planner_terms enable row level security;
alter table public.planner_days enable row level security;
