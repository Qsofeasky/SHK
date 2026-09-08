delete from public.member_yearly_payments
where source_sheet = 'KEAHLIAN';

delete from public.member_dependants
where source_sheet = 'TANGGUNGAN 1';

delete from public.inactive_members
where source_sheet = 'PINDAHBERHENTI';

delete from public.members
where source_sheet = 'KEAHLIAN';
