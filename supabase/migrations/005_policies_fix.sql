-- Missing insert policies + clips storage bucket for platform expansion

create policy conversations_insert on public.conversations
  for insert with check (true);

create policy conversation_members_insert on public.conversation_members
  for insert with check (auth.uid() = profile_id);

-- Allow inserting the other member when you already belong (1:1 open)
create policy conversation_members_insert_peer on public.conversation_members
  for insert with check (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = conversation_members.conversation_id
        and m.profile_id = auth.uid()
    )
  );

-- Ops can manage tournaments via service role; allow status updates for entrants none
-- Tournament create stays service-role from /api/tournaments

insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do nothing;

create policy clips_storage_read on storage.objects
  for select using (bucket_id = 'clips');

create policy clips_storage_write on storage.objects
  for insert with check (
    bucket_id = 'clips'
    and auth.role() = 'service_role'
  );
