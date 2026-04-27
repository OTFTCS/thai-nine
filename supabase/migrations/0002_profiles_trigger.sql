-- Auto-create a profiles row + zero credit_balances row on every auth.users INSERT.
-- Without this trigger, any server-side supabase.auth.admin.createUser() call
-- leaves profiles empty and the first FK-linked INSERT (bookings, payments,
-- credit_grants) fails. Required for guest-checkout silent user creation.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;

  insert into public.credit_balances (user_id, balance)
    values (new.id, 0)
    on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
