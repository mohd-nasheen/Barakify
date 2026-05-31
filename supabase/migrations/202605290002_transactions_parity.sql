alter table public.transactions
  add column if not exists due_date date,
  add column if not exists is_paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists is_recurring boolean not null default false;

create index if not exists idx_transactions_user_month on public.transactions (user_id, transaction_date);
create index if not exists idx_transactions_user_due on public.transactions (user_id, due_date);
