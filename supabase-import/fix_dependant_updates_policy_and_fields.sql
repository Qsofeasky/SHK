alter table public.dependant_updates
add column if not exists new_phone text;

alter table public.dependant_updates
add column if not exists new_address text;

alter table public.dependant_updates
add column if not exists location_latitude numeric(10, 7);

alter table public.dependant_updates
add column if not exists location_longitude numeric(10, 7);

alter table public.dependant_updates
add column if not exists location_url text;

drop policy if exists "Public can submit dependant updates" on public.dependant_updates;

create policy "Public can submit dependant updates"
on public.dependant_updates for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can submit dependant items" on public.dependant_update_items;

create policy "Public can submit dependant items"
on public.dependant_update_items for insert
to anon, authenticated
with check (true);
