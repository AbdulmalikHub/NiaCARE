create extension if not exists pgcrypto;

create type public.app_role as enum ('dentist','assistant','front_office','claims','admin','owner','super_admin');
create type public.invitation_status as enum ('pending','used','revoked','expired');

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  parent_facility_id uuid references public.facilities(id) on delete set null,
  name text not null,
  code text not null unique,
  email text,
  phone text,
  county text,
  active_status boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  active_status boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.facility_members (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (facility_id, user_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  patient_number text not null,
  first_name text not null,
  last_name text not null,
  phone_number text,
  email text,
  date_of_birth date,
  gender text,
  payment_type text,
  created_at timestamptz not null default now(),
  unique (facility_id, patient_number)
);

create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  dentist_id uuid references public.profiles(id) on delete set null,
  plan_number text not null,
  treatment_plan_date date not null default current_date,
  total_estimated_value numeric(12,2) not null default 0,
  status text not null default 'Draft',
  treatment_plan_shared boolean not null default false,
  sharing_method text,
  shared_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique (facility_id, plan_number)
);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  treatment_plan_id uuid not null references public.treatment_plans(id) on delete cascade,
  procedure_name text not null,
  tooth_number text,
  estimated_cost numeric(12,2) not null default 0,
  priority text,
  status text not null default 'Planned',
  next_session_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'Booked',
  reminder_sent_at timestamptz,
  reminder_completed_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  outcome text,
  contacted_at timestamptz,
  next_contact_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.root_canal_cases (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  tooth_number text not null,
  stage text not null default 'Assessment',
  notes text,
  created_at timestamptz not null default now()
);

create table public.braces_cases (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  stage text not null default 'Assessment',
  next_review_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null unique references public.facilities(id) on delete cascade,
  monthly_fee_usd numeric(12,2) not null default 0,
  billing_cycle_start date,
  next_due_date date,
  status text not null default 'active',
  grace_started_at timestamptz,
  mpesa_number_on_file text,
  created_at timestamptz not null default now()
);

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount_usd numeric(12,2) not null,
  method text not null,
  mpesa_receipt text,
  paid_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id) on delete set null,
  cycle_start date,
  cycle_end date
);

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.app_role not null,
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references public.facilities(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.facility_members(user_id);
create index on public.patients(facility_id, created_at desc);
create index on public.treatment_plans(facility_id, status);
create index on public.appointments(facility_id, scheduled_at);
create index on public.follow_ups(facility_id, next_contact_at);
create index on public.staff_invitations(facility_id, status);

create or replace function public.is_facility_member(target_facility_id uuid)
returns boolean language sql stable security invoker set search_path = public
as $$ select exists (select 1 from public.facility_members fm where fm.facility_id = target_facility_id and fm.user_id = (select auth.uid())) $$;

alter table public.facilities enable row level security;
alter table public.profiles enable row level security;
alter table public.facility_members enable row level security;
alter table public.patients enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.procedures enable row level security;
alter table public.appointments enable row level security;
alter table public.follow_ups enable row level security;
alter table public.root_canal_cases enable row level security;
alter table public.braces_cases enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.audit_logs enable row level security;

create policy "members can read facilities" on public.facilities for select to authenticated using (public.is_facility_member(id) or id in (select fm.facility_id from public.facility_members fm where fm.user_id = (select auth.uid())));
create policy "members can read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "members can read memberships" on public.facility_members for select to authenticated using (user_id = (select auth.uid()) or public.is_facility_member(facility_id));

create policy "facility members read patients" on public.patients for select to authenticated using (public.is_facility_member(facility_id));
create policy "facility members write patients" on public.patients for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members read plans" on public.treatment_plans for select to authenticated using (public.is_facility_member(facility_id));
create policy "facility members write plans" on public.treatment_plans for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members read procedures" on public.procedures for select to authenticated using (exists (select 1 from public.treatment_plans tp where tp.id = treatment_plan_id and public.is_facility_member(tp.facility_id)));
create policy "facility members write procedures" on public.procedures for all to authenticated using (exists (select 1 from public.treatment_plans tp where tp.id = treatment_plan_id and public.is_facility_member(tp.facility_id))) with check (exists (select 1 from public.treatment_plans tp where tp.id = treatment_plan_id and public.is_facility_member(tp.facility_id)));
create policy "facility members read appointments" on public.appointments for select to authenticated using (public.is_facility_member(facility_id));
create policy "facility members write appointments" on public.appointments for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members read followups" on public.follow_ups for select to authenticated using (public.is_facility_member(facility_id));
create policy "facility members write followups" on public.follow_ups for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members read clinical tracks" on public.root_canal_cases for select to authenticated using (public.is_facility_member(facility_id));
create policy "facility members write clinical tracks" on public.root_canal_cases for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members read braces" on public.braces_cases for select to authenticated using (public.is_facility_member(facility_id));
create policy "facility members write braces" on public.braces_cases for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members read subscriptions" on public.subscriptions for select to authenticated using (public.is_facility_member(facility_id));
create policy "facility members read payments" on public.subscription_payments for select to authenticated using (exists (select 1 from public.subscriptions s where s.id = subscription_id and public.is_facility_member(s.facility_id)));
create policy "facility members manage invitations" on public.staff_invitations for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members read audit logs" on public.audit_logs for select to authenticated using (facility_id is null or public.is_facility_member(facility_id));
create policy "members create audit logs" on public.audit_logs for insert to authenticated with check (actor_id = (select auth.uid()) and (facility_id is null or public.is_facility_member(facility_id)));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin insert into public.profiles (id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email) on conflict (id) do update set email = excluded.email; return new; end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
