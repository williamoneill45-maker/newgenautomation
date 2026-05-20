create table if not exists public.billing_invoices (
  id text primary key,
  client_id text not null,
  client_name text not null,
  legal_aid_number text not null,
  fam_number text,
  invoice_number text not null unique,
  invoice_total numeric(12, 2) not null default 0,
  form_type text not null check (form_type in ('32B', '33A')),
  status text not null,
  onedrive_url text,
  onedrive_path text,
  generated_file_name text,
  generated_at timestamptz not null,
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
