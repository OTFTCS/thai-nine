-- Thai with Nine — core schema (booking + payments + credits).
-- All CREATE TABLE blocks run first, then a single ALTER TABLE ... ADD CONSTRAINT
-- block handles forward FK references.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- Helper used by every RLS policy (avoids recursive subqueries on profiles).
create or replace function is_teacher_or_admin(uid uuid) returns boolean
  language sql security definer stable as $$
    select exists (select 1 from profiles where id = uid and role in ('teacher','admin'));
  $$;

-- Profiles (1:1 with auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'student' check (role in ('student','teacher','admin')),
  display_name text,
  email text,
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now()
);

-- Weekly recurring availability (teacher-local time)
create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete restrict,
  timezone text not null default 'Asia/Bangkok',
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Sun
  start_time time not null,
  end_time time not null,
  slot_duration_minutes int not null default 60,
  active boolean not null default true
);

-- Per-date overrides (dates interpreted in the override's timezone, else the rule's)
create table availability_overrides (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete restrict,
  date date not null,
  start_time time,
  end_time time,
  kind text not null check (kind in ('add','block')),
  slot_duration_minutes int,                                   -- null -> inherit
  timezone text                                                -- null -> inherit
);

-- Product catalogue
create table lesson_packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                                   -- 'single','pack-5','pack-10'
  name text not null,
  credits int not null,
  price_thb int not null,
  price_usd_cents int not null,
  credit_expiry_days int not null default 365,
  active boolean not null default true
);

-- Credit LOTS - one row per purchase. Source of truth for expiry + remaining.
create table credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete restrict,
  payment_id uuid,
  package_id uuid references lesson_packages(id),
  initial_credits int not null check (initial_credits > 0),
  remaining_credits int not null check (remaining_credits >= 0),
  expires_at timestamptz,
  granted_at timestamptz not null default now(),
  note text,
  constraint ck_remaining_le_initial check (remaining_credits <= initial_credits)
);
-- FIFO correctness: include granted_at for tiebreak.
create index credit_grants_fifo_idx on credit_grants (user_id, expires_at nulls last, granted_at)
  where remaining_credits > 0;

-- Immutable audit log of every credit change.
create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete restrict,
  grant_id uuid not null references credit_grants(id),
  delta int not null,
  reason text not null check (reason in (
    'purchase','booking_debit','cancel_refund','admin_adjust','expiry'
  )),
  booking_id uuid,
  payment_id uuid,
  created_at timestamptz not null default now(),
  constraint ck_booking_required_for_booking_reasons
    check ((reason in ('booking_debit','cancel_refund')) = (booking_id is not null))
);
create index on credit_transactions(user_id, created_at desc);

-- Materialised balance. Only written by the SECURITY DEFINER RPCs below.
create table credit_balances (
  user_id uuid primary key references profiles(id) on delete restrict,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Payments (one row per intent; spans both rails).
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete restrict,
  rail text not null check (rail in ('stripe_card','promptpay_manual')),
  status text not null check (status in ('pending','succeeded','cancelled','refunded')),
  verification_state text check (verification_state in ('pending','verified','refuted')),
  amount_thb int,
  amount_usd_cents int,
  currency text not null check (currency in ('THB','USD')),
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text unique,
  package_id uuid references lesson_packages(id),
  booking_id uuid,
  idempotency_key text unique,                                 -- 'user:{uid}:slot:{iso}:{rail}'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on payments(status, created_at) where status = 'pending';
create index on payments(verification_state) where verification_state = 'pending';

-- Bookings
create table bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete restrict,
  teacher_id uuid not null references profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check (status in ('pending_payment','confirmed','cancelled','completed','no_show')),
  payment_id uuid references payments(id),
  meet_url text,
  calendar_event_id text,
  cancellation_reason text check (cancellation_reason in (
    'student_cancel','teacher_cancel','timeout','admin','promptpay_unverified'
  )),
  notes text,
  created_at timestamptz not null default now()
);
create index on bookings(teacher_id, starts_at);
create index on bookings(student_id, starts_at desc);

-- Half-open exclusion so back-to-back slots don't collide.
alter table bookings add constraint uniq_teacher_slot exclude using gist (
  teacher_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('pending_payment','confirmed'));

-- Forward-FK fixups (all in one place, after every table exists).
alter table credit_grants       add constraint fk_cg_payment  foreign key (payment_id)  references payments(id);
alter table credit_transactions add constraint fk_ct_booking  foreign key (booking_id)  references bookings(id);
alter table credit_transactions add constraint fk_ct_payment  foreign key (payment_id)  references payments(id);
alter table payments            add constraint fk_p_booking   foreign key (booking_id)  references bookings(id);

-- =============================================================================
-- SECURITY DEFINER RPCs (app code never touches credit tables directly)
-- =============================================================================

-- 1. Purchase: create a lot + ledger row + bump balance.
create or replace function purchase_credits(
  p_user uuid, p_payment uuid, p_package uuid, p_credits int, p_expiry_days int
) returns uuid language plpgsql security definer as $$
declare v_grant_id uuid;
begin
  insert into credit_grants(user_id, payment_id, package_id, initial_credits, remaining_credits, expires_at)
    values (p_user, p_payment, p_package, p_credits, p_credits, now() + make_interval(days => p_expiry_days))
    returning id into v_grant_id;
  insert into credit_transactions(user_id, grant_id, delta, reason, payment_id)
    values (p_user, v_grant_id, p_credits, 'purchase', p_payment);
  insert into credit_balances(user_id, balance) values (p_user, p_credits)
    on conflict (user_id) do update
      set balance = credit_balances.balance + excluded.balance, updated_at = now();
  return v_grant_id;
end $$;

-- 2. Debit FIFO from the oldest unexpired lot. Atomic.
-- INSERT the booking FIRST so exclusion-constraint failures abort before any credit movement.
create or replace function book_with_credit(
  p_user uuid, p_teacher uuid, p_start timestamptz, p_end timestamptz
) returns bookings language plpgsql security definer as $$
declare
  v_grant credit_grants%rowtype;
  v_booking bookings;
begin
  insert into bookings(student_id, teacher_id, starts_at, ends_at, status)
    values (p_user, p_teacher, p_start, p_end, 'confirmed')
    returning * into v_booking;

  select * into v_grant from credit_grants
    where user_id = p_user and remaining_credits > 0 and (expires_at is null or expires_at > now())
    order by expires_at nulls last, granted_at asc
    for update                                                 -- NOT SKIP LOCKED; true FIFO
    limit 1;
  if not found then raise exception 'insufficient_credit'; end if;

  update credit_grants  set remaining_credits = remaining_credits - 1 where id = v_grant.id;
  update credit_balances set balance = balance - 1, updated_at = now() where user_id = p_user;
  insert into credit_transactions(user_id, grant_id, delta, reason, booking_id)
    values (p_user, v_grant.id, -1, 'booking_debit', v_booking.id);

  return v_booking;
end $$;

-- 3. Refund to the original lot (preserving original expiry).
create or replace function refund_booking_credit(p_booking uuid) returns boolean
  language plpgsql security definer as $$
declare v_txn credit_transactions%rowtype; v_grant credit_grants%rowtype;
begin
  select * into v_txn from credit_transactions
    where booking_id = p_booking and reason = 'booking_debit' limit 1;
  if not found then return false; end if;
  select * into v_grant from credit_grants where id = v_txn.grant_id for update;
  if v_grant.expires_at is not null and v_grant.expires_at < now() then return false; end if;

  update credit_grants  set remaining_credits = remaining_credits + 1 where id = v_grant.id;
  update credit_balances set balance = balance + 1, updated_at = now() where user_id = v_txn.user_id;
  insert into credit_transactions(user_id, grant_id, delta, reason, booking_id)
    values (v_txn.user_id, v_grant.id, 1, 'cancel_refund', p_booking);
  return true;
end $$;

-- 4. Nightly expiry sweep.
create or replace function expire_credits() returns int
  language plpgsql security definer as $$
declare v_grant credit_grants%rowtype; v_count int := 0;
begin
  for v_grant in select * from credit_grants
    where expires_at < now() and remaining_credits > 0 for update
  loop
    insert into credit_transactions(user_id, grant_id, delta, reason)
      values (v_grant.user_id, v_grant.id, -v_grant.remaining_credits, 'expiry');
    update credit_balances set balance = balance - v_grant.remaining_credits, updated_at = now()
      where user_id = v_grant.user_id;
    update credit_grants set remaining_credits = 0 where id = v_grant.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- 5. Admin adjust (creates a non-expiring lot).
create or replace function admin_adjust_credits(p_user uuid, p_delta int, p_note text) returns uuid
  language plpgsql security definer as $$
declare v_grant_id uuid;
begin
  if p_delta <= 0 then raise exception 'admin_adjust_requires_positive_delta'; end if;
  insert into credit_grants(user_id, initial_credits, remaining_credits, expires_at, note)
    values (p_user, p_delta, p_delta, null, p_note) returning id into v_grant_id;
  insert into credit_transactions(user_id, grant_id, delta, reason)
    values (p_user, v_grant_id, p_delta, 'admin_adjust');
  insert into credit_balances(user_id, balance) values (p_user, p_delta)
    on conflict (user_id) do update
      set balance = credit_balances.balance + excluded.balance, updated_at = now();
  return v_grant_id;
end $$;

-- =============================================================================
-- Column-level grants on profiles (actual guard against role escalation)
-- =============================================================================

revoke update on profiles from authenticated;
grant update (display_name, timezone) on profiles to authenticated;
-- Role/email changes happen via admin-only RPC, not direct UPDATE.

-- =============================================================================
-- RLS policies
-- =============================================================================

alter table profiles                enable row level security;
alter table bookings                enable row level security;
alter table payments                enable row level security;
alter table credit_transactions     enable row level security;
alter table credit_balances         enable row level security;
alter table credit_grants           enable row level security;
alter table availability_rules      enable row level security;
alter table availability_overrides  enable row level security;
alter table lesson_packages         enable row level security;

create policy profiles_self_read   on profiles            for select using (id = auth.uid() or is_teacher_or_admin(auth.uid()));
create policy profiles_self_update on profiles            for update using (id = auth.uid()) with check (id = auth.uid());

create policy bookings_self_read   on bookings            for select using (student_id = auth.uid() or is_teacher_or_admin(auth.uid()));
create policy payments_self_read   on payments            for select using (user_id    = auth.uid() or is_teacher_or_admin(auth.uid()));
create policy credit_tx_self_read  on credit_transactions for select using (user_id    = auth.uid() or is_teacher_or_admin(auth.uid()));
create policy credit_bal_self_read on credit_balances     for select using (user_id    = auth.uid() or is_teacher_or_admin(auth.uid()));
create policy credit_grants_self_read on credit_grants    for select using (user_id    = auth.uid() or is_teacher_or_admin(auth.uid()));

create policy avail_rules_public_read  on availability_rules     for select using (true);
create policy avail_ovr_public_read    on availability_overrides for select using (true);
create policy packages_public_read     on lesson_packages        for select using (active);

-- All writes to bookings/payments/credit tables run through service-role code
-- paths or the RPCs above - no client write policies.
