create type public.operation_priority as enum ('information','attention','warning','critical');
create type public.operation_task_status as enum ('open','in_progress','completed','overdue','cancelled');
create type public.operation_event_type as enum ('treatment_status_changed','appointment_created','appointment_missed','appointment_cancelled','recall_due','complaint_received','incident_reported','ipc_finding','corrective_action_created');

create table public.operational_events (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type public.operation_event_type not null,
  source_table text not null,
  source_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (facility_id, source_table, source_id, event_type, occurred_at)
);

create table public.operation_tasks (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_role public.app_role,
  patient_id uuid references public.patients(id) on delete set null,
  event_id uuid references public.operational_events(id) on delete set null,
  title text not null,
  description text,
  priority public.operation_priority not null default 'attention',
  status public.operation_task_status not null default 'open',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.operation_notifications (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_role public.app_role,
  task_id uuid references public.operation_tasks(id) on delete cascade,
  event_id uuid references public.operational_events(id) on delete set null,
  priority public.operation_priority not null default 'information',
  title text not null,
  message text not null,
  due_at timestamptz,
  read_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.follow_up_records (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  follow_up_type text not null,
  reason text,
  outcome text,
  contact_attempted_at timestamptz,
  contact_successful boolean,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.recall_records (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at date not null,
  contacted_at timestamptz,
  outcome text,
  booked_appointment_id uuid references public.appointments(id) on delete set null,
  next_contact_at date,
  created_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  priority public.operation_priority not null default 'attention',
  category text not null,
  status text not null default 'received',
  description text not null,
  received_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  resolution text
);

create table public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  reporter_id uuid references public.profiles(id) on delete set null,
  investigator_id uuid references public.profiles(id) on delete set null,
  incident_type text not null,
  severity public.operation_priority not null default 'attention',
  status text not null default 'reported',
  description text not null,
  occurred_at timestamptz not null,
  closed_at timestamptz
);

create table public.ipc_audits (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  auditor_id uuid references public.profiles(id) on delete set null,
  audit_date date not null default current_date,
  score numeric(5,2),
  status text not null default 'open',
  notes text
);

create table public.ipc_audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.ipc_audits(id) on delete cascade,
  category text not null,
  result text not null,
  risk public.operation_priority,
  finding text,
  corrective_action_id uuid,
  created_at timestamptz not null default now()
);

create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  source_type text not null,
  source_id uuid,
  action text not null,
  reason text,
  priority public.operation_priority not null default 'attention',
  status text not null default 'open',
  due_at timestamptz,
  evidence text,
  review_at timestamptz,
  verified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null,
  trigger_type public.operation_event_type not null,
  condition jsonb not null default '{}'::jsonb,
  recipient_role public.app_role not null,
  priority public.operation_priority not null default 'attention',
  message_template text not null,
  escalation_after_hours integer,
  active_status boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.management_actions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'open'
);

create table public.practice_insights (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  branch_id uuid references public.facilities(id) on delete set null,
  kpi_key text not null,
  severity public.operation_priority not null,
  title text not null,
  summary text not null,
  period_start date not null,
  period_end date not null,
  supporting_query jsonb not null default '{}'::jsonb,
  management_action_id uuid references public.management_actions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index operational_events_facility_time_idx on public.operational_events(facility_id, occurred_at desc);
create index operation_tasks_due_idx on public.operation_tasks(facility_id, status, due_at);
create index operation_notifications_recipient_idx on public.operation_notifications(recipient_id, read_at, created_at desc);
create index follow_up_records_due_idx on public.follow_up_records(facility_id, next_follow_up_at);
create index recall_records_due_idx on public.recall_records(facility_id, due_at);
create index complaints_status_idx on public.complaints(facility_id, status, due_at);
create index safety_incidents_status_idx on public.safety_incidents(facility_id, status);
create index corrective_actions_due_idx on public.corrective_actions(facility_id, status, due_at);
create index practice_insights_period_idx on public.practice_insights(facility_id, period_end desc);

alter table public.operational_events enable row level security;
alter table public.operation_tasks enable row level security;
alter table public.operation_notifications enable row level security;
alter table public.follow_up_records enable row level security;
alter table public.recall_records enable row level security;
alter table public.complaints enable row level security;
alter table public.safety_incidents enable row level security;
alter table public.ipc_audits enable row level security;
alter table public.ipc_audit_items enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.notification_rules enable row level security;
alter table public.management_actions enable row level security;
alter table public.practice_insights enable row level security;

create policy "facility members manage operational events" on public.operational_events for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members manage operation tasks" on public.operation_tasks for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "recipients read notifications" on public.operation_notifications for select to authenticated using (recipient_id = (select auth.uid()) or public.is_facility_member(facility_id));
create policy "members manage notifications" on public.operation_notifications for update to authenticated using (recipient_id = (select auth.uid()) or public.is_facility_member(facility_id)) with check (recipient_id = (select auth.uid()) or public.is_facility_member(facility_id));
create policy "facility members manage follow ups" on public.follow_up_records for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members manage recalls" on public.recall_records for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members manage complaints" on public.complaints for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members manage incidents" on public.safety_incidents for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members manage ipc audits" on public.ipc_audits for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members manage corrective actions" on public.corrective_actions for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members manage notification rules" on public.notification_rules for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members manage management actions" on public.management_actions for all to authenticated using (public.is_facility_member(facility_id)) with check (public.is_facility_member(facility_id));
create policy "facility members read insights" on public.practice_insights for select to authenticated using (public.is_facility_member(facility_id));

grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.ipc_audit_items add constraint ipc_audit_items_corrective_action_fk foreign key (corrective_action_id) references public.corrective_actions(id) on delete set null;
