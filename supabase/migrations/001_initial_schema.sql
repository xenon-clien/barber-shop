-- ============================================================
-- Three Brother Saloon — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- ─────────────────────────────────────────────────
-- 1. USERS
-- ─────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique not null,
  phone       text,
  role        text not null default 'client' check (role in ('client','barber','admin')),
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can only read/update their own profile
create policy "users_select_own" on public.users
  for select using ( auth.uid() = id );

create policy "users_update_own" on public.users
  for update using ( auth.uid() = id );

-- Allow insert during signup (via trigger from auth.users)
create policy "users_insert_own" on public.users
  for insert with check ( auth.uid() = id );

-- ─────────────────────────────────────────────────
-- 2. SERVICES
-- ─────────────────────────────────────────────────
create table if not exists public.services (
  id                serial primary key,
  name              text not null,
  category          text not null check (category in ('Haircuts','Beard & Shaving','Hair Color','Facial','Combos')),
  price             numeric(10,2) not null,
  duration_minutes  int not null,
  description       text
);

alter table public.services enable row level security;

-- Everyone can read services
create policy "services_public_select" on public.services
  for select using ( true );

-- ─────────────────────────────────────────────────
-- 3. BARBERS
-- ─────────────────────────────────────────────────
create table if not exists public.barbers (
  id                  serial primary key,
  name                text not null,
  specialty           text,
  rating              numeric(2,1) default 5.0 check (rating between 1 and 5),
  image_url           text,
  availability_status boolean not null default true
);

alter table public.barbers enable row level security;

-- Everyone can read barbers
create policy "barbers_public_select" on public.barbers
  for select using ( true );

-- ─────────────────────────────────────────────────
-- 4. BOOKINGS
-- ─────────────────────────────────────────────────
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  barber_id       int references public.barbers(id),
  total_price     numeric(10,2) not null default 0,
  total_duration  int not null default 0,
  booking_date    date not null,
  time_slot       time not null,
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','completed','cancelled')),
  created_at      timestamptz not null default now()
);

alter table public.bookings enable row level security;

-- Clients can insert their own bookings
create policy "bookings_insert_own" on public.bookings
  for insert with check ( auth.uid() = user_id );

-- Clients can select their own bookings
create policy "bookings_select_own" on public.bookings
  for select using ( auth.uid() = user_id );

-- Clients can update (cancel) their own bookings
create policy "bookings_update_own" on public.bookings
  for update using ( auth.uid() = user_id );

-- Allow anon select for slot validation queries (barber availability)
create policy "bookings_select_for_slots" on public.bookings
  for select using ( status in ('confirmed','pending') );

-- ─────────────────────────────────────────────────
-- 5. BOOKING_ITEMS
-- ─────────────────────────────────────────────────
create table if not exists public.booking_items (
  id          serial primary key,
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  service_id  int  not null references public.services(id)
);

alter table public.booking_items enable row level security;

create policy "booking_items_insert_own" on public.booking_items
  for insert with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.user_id = auth.uid()
    )
  );

create policy "booking_items_select_own" on public.booking_items
  for select using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────
-- 6. AUTO-CREATE USER PROFILE ON SIGNUP (TRIGGER)
-- ─────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────
-- 7. SEED — SERVICES
-- ─────────────────────────────────────────────────
insert into public.services (name, category, price, duration_minutes, description) values
  -- Haircuts
  ('Classic Haircut',         'Haircuts',        15.00, 30,  'Traditional scissor cut with styling'),
  ('Fade & Taper',            'Haircuts',        20.00, 45,  'Sharp skin or mid-fade with seamless taper'),
  ('Executive Cut',           'Haircuts',        25.00, 45,  'Premium businessman cut with hot towel finish'),
  ('Kids Haircut',            'Haircuts',        10.00, 20,  'Gentle, fun haircut for boys under 12'),
  -- Beard & Shaving
  ('Beard Trim & Shape',      'Beard & Shaving', 12.00, 20,  'Precision beard sculpting and lining'),
  ('Hot Towel Shave',         'Beard & Shaving', 18.00, 35,  'Luxury straight-razor shave with hot towels'),
  ('Full Beard Grooming',     'Beard & Shaving', 22.00, 40,  'Wash, condition, shape, and style full beard'),
  -- Hair Color
  ('Full Color',              'Hair Color',      45.00, 90,  'All-over single color treatment'),
  ('Highlights / Lowlights',  'Hair Color',      55.00, 120, 'Hand-painted dimensional color'),
  -- Facial
  ('Deep Cleanse Facial',     'Facial',          35.00, 50,  'Pore cleanse, steam, and mask treatment'),
  -- Combos
  ('The Gentleman (Cut+Shave)','Combos',         30.00, 60,  'Classic haircut + hot towel straight-razor shave'),
  ('The King (Cut+Beard+Facial)','Combos',       65.00, 120, 'Full haircut, beard grooming & deep cleanse facial')
on conflict do nothing;

-- ─────────────────────────────────────────────────
-- 8. SEED — BARBERS
-- ─────────────────────────────────────────────────
insert into public.barbers (name, specialty, rating, image_url, availability_status) values
  ('Ahmed Khan',    'Classic Cuts & Hot Towel Shave', 4.9, 'https://i.pravatar.cc/200?img=11', true),
  ('Ravi Sharma',   'Fades, Tapers & Hair Color',     4.8, 'https://i.pravatar.cc/200?img=13', true),
  ('Carlos Mendez', 'Beard Art & Straight Razor',     4.7, 'https://i.pravatar.cc/200?img=15', true),
  ('James Brooks',  'Executive Cuts & Facials',       4.9, 'https://i.pravatar.cc/200?img=17', true)
on conflict do nothing;
