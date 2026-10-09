-- AI Launch Africa — email credits schema (Supabase / Postgres)
--
-- Run this once in your Supabase project's SQL editor (Dashboard ->
-- SQL Editor -> New query -> paste this whole file -> Run).
--
-- This is a SINGLE-ACCOUNT system: there is one credit balance (yours),
-- not per-customer accounts. That's why `account` only ever has one row.

create table if not exists account (
  id smallint primary key default 1,
  credits integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into account (id, credits) values (1, 0) on conflict (id) do nothing;

create table if not exists payment_transactions (
  id bigserial primary key,
  reference text unique not null,
  package text not null,
  credits integer not null,
  amount numeric not null,
  currency text not null default 'NGN',
  gateway text not null default 'remita',
  -- pending | successful | failed | cancelled | verification_failed
  status text not null default 'pending',
  raw_gateway_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (
  id bigserial primary key,
  delta integer not null,            -- +credits on purchase, -1 on email use
  reason text not null,              -- purchase | email_reserved | email_consumed | email_released
  reference text,                    -- payment reference, when reason = 'purchase'
  status text not null default 'final', -- reserved | consumed | released | final
  created_at timestamptz not null default now()
);

create table if not exists sent_emails (
  id bigserial primary key,
  recipient_company text,
  recipient_email text,
  subject text,
  body text,
  status text not null default 'pending', -- pending | sent | failed
  credit_ledger_id bigint references credit_ledger(id),
  created_at timestamptz not null default now()
);

-- Atomically reserve 1 credit before attempting to send an email.
-- Returns no rows if the balance is 0 — caller must treat an empty
-- result as "insufficient credits", not as a valid reservation.
create or replace function reserve_credit()
returns table(ledger_id bigint, remaining_credits integer)
language plpgsql
as $$
declare
  v_remaining integer;
  v_ledger_id bigint;
begin
  update account set credits = credits - 1, updated_at = now()
    where id = 1 and credits >= 1
    returning credits into v_remaining;

  if v_remaining is null then
    return; -- no row updated -> insufficient credits, yield nothing
  end if;

  insert into credit_ledger (delta, reason, status)
    values (-1, 'email_reserved', 'reserved')
    returning id into v_ledger_id;

  return query select v_ledger_id, v_remaining;
end;
$$;

-- Mark a reserved credit as permanently spent (the email actually sent).
create or replace function consume_credit(p_ledger_id bigint)
returns void
language sql
as $$
  update credit_ledger set status = 'consumed'
    where id = p_ledger_id and status = 'reserved';
$$;

-- Give a reserved credit back (the send failed) so nothing was charged
-- for an email that never went out.
create or replace function release_credit(p_ledger_id bigint)
returns void
language plpgsql
as $$
begin
  update credit_ledger set status = 'released'
    where id = p_ledger_id and status = 'reserved';

  if found then
    update account set credits = credits + 1, updated_at = now() where id = 1;
  end if;
end;
$$;

-- Idempotently credit a verified payment. Safe to call more than once
-- for the same reference (e.g. a retried request) — credits are only
-- ever added the first time a reference is marked successful. Locks
-- the row (FOR UPDATE) so two near-simultaneous calls can't both pass.
create or replace function credit_payment(p_reference text, p_credits integer)
returns table(already_processed boolean, new_balance integer)
language plpgsql
as $$
declare
  v_status text;
  v_balance integer;
begin
  select status into v_status from payment_transactions
    where reference = p_reference for update;

  if v_status is null then
    raise exception 'unknown payment reference: %', p_reference;
  end if;

  if v_status = 'successful' then
    select credits into v_balance from account where id = 1;
    return query select true, v_balance;
    return;
  end if;

  update payment_transactions set status = 'successful', updated_at = now()
    where reference = p_reference;

  update account set credits = credits + p_credits, updated_at = now()
    where id = 1
    returning credits into v_balance;

  insert into credit_ledger (delta, reason, reference, status)
    values (p_credits, 'purchase', p_reference, 'final');

  return query select false, v_balance;
end;
$$;
