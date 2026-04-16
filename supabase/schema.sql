create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('add', 'remove')),
  quantity integer not null check (quantity > 0),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_movements_product_id on public.movements(product_id);
create index if not exists idx_movements_created_at on public.movements(created_at desc);

insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;
