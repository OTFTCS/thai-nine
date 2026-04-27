-- Seed the 'single' lesson package so single-lesson cash purchases flow through
-- the credit ledger uniformly (purchase_credits -> book_with_credit debit).
-- This closes the cancel-refund gap where cash-paid singles had no
-- booking_debit transaction for refund_booking_credit() to target, making
-- every >=24h cancellation a silent forfeit regardless of the stated policy.
--
-- Prices are placeholders — Nine to confirm before go-live via:
--   update lesson_packages set price_thb = <new>, price_usd_cents = <new> where slug = 'single';
-- Credit expiry (180 days) is also a placeholder; revisit if unused-single-
-- credits show up as a retention issue.

insert into lesson_packages (slug, name, credits, price_thb, price_usd_cents, credit_expiry_days, active)
values ('single', 'Single lesson', 1, 800, 2400, 180, true)
on conflict (slug) do nothing;
