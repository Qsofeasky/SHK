-- SHK: semakan dan pemulihan PENDAFTARAN BARU yang telah diluluskan.
-- Jalankan hanya pada project hrvbnayanswugfwdfhto, melalui SQL Editor.
-- Tidak memadam atau mengubah ahli sedia ada. Tidak mengulang kemaskini maklumat lama.
BEGIN;
LOCK TABLE public.members IN SHARE ROW EXCLUSIVE MODE;

-- Pulihkan hanya permohonan dengan IC lengkap, unik antara permohonan diluluskan,
-- dan tiada rekod sepadan (termasuk ahli tidak aktif).
WITH candidates AS (
 SELECT c.*, regexp_replace(coalesce(c.member_identifier,''),'[^0-9]','','g') AS normalized_ic,
 count(*) OVER (PARTITION BY regexp_replace(coalesce(c.member_identifier,''),'[^0-9]','','g')) AS same_ic_count
 FROM public.membership_checks c
 WHERE c.check_type='daftar' AND c.status='approved'
), restored AS (
 INSERT INTO public.members
 (member_no,member_name,ic_no,phone,email,occupation,address,source_sheet,source_submission_id)
 SELECT c.member_identifier,c.member_name,c.member_identifier,c.phone,c.email,c.occupation,c.address,'WEBSITE',c.id
 FROM candidates c
 WHERE length(c.normalized_ic)=12 AND c.same_ic_count=1
 AND NOT EXISTS (
 SELECT 1 FROM public.members m
 WHERE m.source_submission_id=c.id
 OR regexp_replace(coalesce(m.ic_no,''),'[^0-9]','','g')=c.normalized_ic
 OR regexp_replace(coalesce(m.member_no,''),'[^0-9]','','g')=c.normalized_ic
 OR lower(trim(m.member_name))=lower(trim(c.member_name))
 )
 AND NOT EXISTS (
 SELECT 1 FROM public.inactive_members i
 WHERE regexp_replace(coalesce(i.member_no,''),'[^0-9]','','g')=c.normalized_ic
 OR lower(trim(i.member_name))=lower(trim(c.member_name))
 )
 RETURNING source_submission_id
)
SELECT count(*) AS bilangan_pendaftaran_dipulihkan FROM restored;
COMMIT;

-- Permohonan yang masih tiada pautan terus: semak manual, jangan daftar semula membuta tuli.
SELECT c.id AS submission_id,c.member_name,c.created_at
FROM public.membership_checks c
WHERE c.check_type='daftar' AND c.status='approved'
AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.source_submission_id=c.id)
ORDER BY c.created_at DESC;
