-- Amounts are stored in hundredths of the currency. A plain integer tops out
-- at about 21 million, fine for pounds but not for currencies with large
-- numbers (50,000,000 Vietnamese dong is about £1,500). bigint removes the
-- ceiling; the app reads them as ordinary numbers either way.
alter table public.expenses       alter column amount_cents type bigint;
alter table public.expense_splits alter column amount_cents type bigint;
alter table public.payments       alter column amount_cents type bigint;
