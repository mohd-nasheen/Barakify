-- Schema/frontend alignment migration (ALTER-only, data-preserving)
-- Keeps existing tables and data intact.

-- 1) Align transactions with frontend parity expectations.
alter table public.transactions
  add column if not exists due_date date,
  add column if not exists is_paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists is_recurring boolean not null default false;

-- 2) Keep month workflows fast and stable.
create index if not exists idx_transactions_user_month
  on public.transactions (user_id, transaction_date);

create index if not exists idx_transactions_user_due
  on public.transactions (user_id, due_date);

-- 3) Ensure category/budget upsert conflict targets are backed by unique indexes.
create unique index if not exists uq_categories_user_name_type
  on public.categories (user_id, name, type);

create unique index if not exists uq_budgets_user_category
  on public.budgets (user_id, category);
