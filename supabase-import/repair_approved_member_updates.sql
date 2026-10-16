-- Jalankan SELEPAS SHK-kemaskini-dan-tanggungan.sql, dalam SQL Editor projek SHK.
-- Identiti ahli 168 untuk dua permohonan ini telah disahkan oleh pentadbir.
BEGIN;
UPDATE public.dependant_updates u
SET member_id=m.id
FROM public.members m
WHERE m.id='e47cac26-dd35-4569-a6c0-9dd09523c3d0'::uuid AND trim(m.member_no)='168'
 AND u.id IN ('07948bc5-b877-41f9-bd8b-623bb8933f8e'::uuid,'d4548322-0495-428e-9c80-1d76c22a0fe2'::uuid)
 AND lower(trim(u.member_name))='ahmad zaki bin abd wahab'
 AND u.status='approved' AND u.applied_at IS NULL;
COMMIT;

-- Semak SETIAP baris laporan.
-- applied: perubahan disimpan dan disertakan audit.
-- SEMAK/SKIP: tidak dipulihkan; tiada tekaan nama atau rekod berganda dibuat.
-- Untuk SEMAK/SKIP, semak permohonan dalam Admin > Kelulusan > Diluluskan.
-- Gunakan "Semak dan Pulihkan" hanya selepas sahkan nombor ahli asal.
SELECT * FROM public.repair_approved_member_updates();

SELECT status,
 count(*) FILTER (WHERE applied_at IS NOT NULL) AS disahkan_tersimpan,
 count(*) FILTER (WHERE applied_at IS NULL) AS belum_disahkan_tersimpan
FROM public.dependant_updates
WHERE status='approved'
GROUP BY status;
