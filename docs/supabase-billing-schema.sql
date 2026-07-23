create table if not exists public.billing_clients (
  id text primary key,
  client_name text not null,
  legal_aid_number text not null default '',
  latest_legal_aid_generated_at timestamptz,
  onedrive_client_folder text,
  first_name text,
  last_name text,
  source_import text,
  source_client_name text,
  client_email text not null default '',
  application_type text not null default '',
  onedrive_client_folder_path text not null default '',
  onedrive_forms_folder_path text not null default '',
  onedrive_billing_folder_path text not null default '',
  onedrive_client_folder_url text not null default '',
  induction_request_path text not null default '',
  engagement_status text not null default 'not_started',
  adobe_agreement_id text not null default '',
  adobe_agreement_status text not null default 'not_sent',
  adobe_agreement_sent_at timestamptz,
  adobe_agreement_name text not null default '',
  adobe_agreement_error text not null default '',
  required_document_one_uploaded boolean not null default false,
  required_document_two_uploaded boolean not null default false,
  msd_request_status text not null default 'not_started',
  legal_aid_application_status text not null default 'not_started',
  signed_forms_path text not null default '',
  msd_response_path text not null default '',
  induction_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matters (
  id text primary key,
  client_id text not null default '',
  client_name text not null,
  legal_aid_number text not null default '',
  fam_number text not null default '',
  legal_aid_required boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_documents', 'documents_generated')),
  intake_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.matters add column if not exists client_id text not null default '';
alter table public.matters add column if not exists legal_aid_required boolean not null default true;
alter table public.matters add column if not exists intake_json jsonb not null default '{}'::jsonb;
create index if not exists matters_client_name_idx on public.matters (client_name);
create index if not exists matters_updated_at_idx on public.matters (updated_at desc);
alter table public.matters enable row level security;
revoke all on table public.matters from anon, authenticated;
grant select, insert, update, delete on table public.matters to service_role;

alter table public.billing_clients add column if not exists adobe_agreement_id text not null default '';
alter table public.billing_clients add column if not exists adobe_agreement_status text not null default 'not_sent';
alter table public.billing_clients add column if not exists adobe_agreement_sent_at timestamptz;
alter table public.billing_clients add column if not exists adobe_agreement_name text not null default '';
alter table public.billing_clients add column if not exists adobe_agreement_error text not null default '';
alter table public.billing_clients add column if not exists required_document_one_uploaded boolean not null default false;
alter table public.billing_clients add column if not exists required_document_two_uploaded boolean not null default false;

alter table public.billing_clients enable row level security;
drop policy if exists "billing_clients_select_authenticated" on public.billing_clients;
drop policy if exists "billing_clients_insert_authenticated" on public.billing_clients;
drop policy if exists "billing_clients_update_authenticated" on public.billing_clients;
revoke all on table public.billing_clients from anon, authenticated;
grant select, insert, update, delete on table public.billing_clients to service_role;

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

alter table public.billing_invoices add column if not exists client_id text;
alter table public.billing_invoices add column if not exists fam_number text;
alter table public.billing_invoices add column if not exists evidence_files_json jsonb not null default '[]'::jsonb;
alter table public.billing_invoices add column if not exists billing_record_json jsonb;
alter table public.billing_invoices add column if not exists onedrive_url text;
alter table public.billing_invoices add column if not exists onedrive_path text;
alter table public.billing_invoices add column if not exists generated_file_name text;
alter table public.billing_invoices add column if not exists generated_at timestamptz;
create index if not exists billing_invoices_client_idx on public.billing_invoices (client_id, client_name);

alter table public.billing_invoices enable row level security;
revoke all on table public.billing_invoices from anon, authenticated;
grant select, insert, update, delete on table public.billing_invoices to service_role;
drop policy if exists "billing_invoices_select_authenticated" on public.billing_invoices;
drop policy if exists "billing_invoices_insert_authenticated" on public.billing_invoices;
drop policy if exists "billing_invoices_update_authenticated" on public.billing_invoices;

create table if not exists public.legal_aid_applications (
  id text primary key,
  matter_id text not null,
  client_name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_income_proof', 'pending_signed_page', 'ready_to_generate', 'generated', 'submitted')),
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
drop policy if exists "legal_aid_applications_select_authenticated" on public.legal_aid_applications;
drop policy if exists "legal_aid_applications_insert_authenticated" on public.legal_aid_applications;
drop policy if exists "legal_aid_applications_update_authenticated" on public.legal_aid_applications;
revoke all on table public.legal_aid_applications from anon, authenticated;
grant select, insert, update, delete on table public.legal_aid_applications to service_role;

insert into storage.buckets (id, name, public)
values ('legal-aid-uploads', 'legal-aid-uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('forms', 'forms', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('billing', 'billing', false)
on conflict (id) do nothing;

create table if not exists public.legal_aid_claims (
  id uuid primary key default gen_random_uuid(),
  firm_id text not null,
  claim_id text not null,
  client_name text not null,
  legal_aid_number text not null default '',
  matter_name text not null,
  form_type text not null check (form_type in ('32B', '33A')),
  amount_claimed numeric(12, 2) not null check (amount_claimed >= 0),
  date_generated date not null default current_date,
  date_sent date,
  claim_status text not null default 'Draft' check (claim_status in ('Draft', 'Generated', 'Sent', 'Paid', 'Overdue')),
  paid_status text not null default 'Unpaid' check (paid_status in ('Unpaid', 'Paid', 'Part Paid')),
  date_paid date,
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  outstanding_amount numeric(12, 2) not null check (outstanding_amount >= 0),
  storage_provider text not null default '',
  storage_location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, claim_id)
);

create index if not exists legal_aid_claims_firm_date_idx
  on public.legal_aid_claims (firm_id, date_generated desc);

alter table public.legal_aid_claims enable row level security;
revoke all on table public.legal_aid_claims from anon, authenticated;
grant select, insert, update, delete on table public.legal_aid_claims to service_role;

-- Safe extensions for projects created from an earlier version of this schema.
alter table public.legal_aid_applications drop constraint if exists legal_aid_applications_status_check;
alter table public.legal_aid_applications add constraint legal_aid_applications_status_check
  check (status in ('draft', 'pending_income_proof', 'pending_signed_page', 'ready_to_generate', 'generated', 'submitted'));

alter table public.legal_aid_claims add column if not exists legal_aid_number text not null default '';
alter table public.legal_aid_claims add column if not exists date_generated date not null default current_date;
alter table public.legal_aid_claims alter column date_sent drop not null;
alter table public.legal_aid_claims add column if not exists claim_status text not null default 'Draft';
alter table public.legal_aid_claims add column if not exists storage_provider text not null default '';
alter table public.legal_aid_claims add column if not exists storage_location text not null default '';
alter table public.legal_aid_claims drop constraint if exists legal_aid_claims_claim_status_check;
alter table public.legal_aid_claims add constraint legal_aid_claims_claim_status_check
  check (claim_status in ('Draft', 'Generated', 'Sent', 'Paid', 'Overdue'));
update public.legal_aid_claims
set claim_status = case when paid_status = 'Paid' then 'Paid' else 'Sent' end,
    date_generated = coalesce(date_generated, date_sent, created_at::date)
where claim_status = 'Draft' and date_sent is not null;
