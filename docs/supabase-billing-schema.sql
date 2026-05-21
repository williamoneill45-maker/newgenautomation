create table if not exists public.billing_clients (
  id text primary key,
  client_name text not null,
  legal_aid_number text not null default '',
  latest_legal_aid_generated_at timestamptz,
  onedrive_client_folder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_clients enable row level security;

create policy "billing_clients_select_authenticated"
on public.billing_clients
for select
to authenticated
using (true);

create policy "billing_clients_insert_authenticated"
on public.billing_clients
for insert
to authenticated
with check (true);

create policy "billing_clients_update_authenticated"
on public.billing_clients
for update
to authenticated
using (true)
with check (true);

create table if not exists public.billing_invoices (
  id text primary key,
  client_name text not null,
  legal_aid_number text not null default '',
  invoice_number text not null unique,
  invoice_total numeric(12, 2) not null default 0,
  client_id text,
  fam_number text,
  form_type text check (form_type in ('32B', '33A')),
  status text,
  evidence_json jsonb not null default '[]'::jsonb,
  evidence_files_json jsonb not null default '[]'::jsonb,
  billing_record_json jsonb,
  onedrive_url text,
  onedrive_path text,
  generated_file_name text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_invoices enable row level security;

create policy "billing_invoices_select_authenticated"
on public.billing_invoices
for select
to authenticated
using (true);

create policy "billing_invoices_insert_authenticated"
on public.billing_invoices
for insert
to authenticated
with check (true);

create policy "billing_invoices_update_authenticated"
on public.billing_invoices
for update
to authenticated
using (true)
with check (true);

create table if not exists public.legal_aid_applications (
  id text primary key,
  matter_id text not null,
  client_name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_income_proof', 'pending_signed_page', 'ready_to_generate', 'generated')),
  review jsonb not null default '{}'::jsonb,
  has_income_proof boolean not null default false,
  has_signed_page boolean not null default false,
  income_proof_path text,
  signed_page_path text,
  income_proof_file_name text,
  signed_page_file_name text,
  template_path text not null default 'templates/Legal Aid Template.pdf',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_aid_applications enable row level security;

create policy "legal_aid_applications_select_authenticated"
on public.legal_aid_applications
for select
to authenticated
using (true);

create policy "legal_aid_applications_insert_authenticated"
on public.legal_aid_applications
for insert
to authenticated
with check (true);

create policy "legal_aid_applications_update_authenticated"
on public.legal_aid_applications
for update
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('legal-aid-uploads', 'legal-aid-uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('forms', 'forms', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('billing', 'billing', false)
on conflict (id) do nothing;
