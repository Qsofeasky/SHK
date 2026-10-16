BEGIN;
CREATE OR REPLACE FUNCTION public.shk_member_by_repair_phone(p_phone text)
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE digits text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); matches uuid[];
BEGIN
 IF digits LIKE '60%' THEN digits:='0'||substr(digits,3); END IF;
 IF digits NOT LIKE '01%' OR length(digits) NOT IN (10,11) THEN RAISE EXCEPTION 'Masukkan nombor telefon bimbit ahli yang sah.'; END IF;
 SELECT array_agg(m.id) INTO matches FROM public.members m
 WHERE CASE WHEN regexp_replace(coalesce(m.phone,''),'[^0-9]','','g') LIKE '60%'
 THEN '0'||substr(regexp_replace(m.phone,'[^0-9]','','g'),3)
 ELSE regexp_replace(coalesce(m.phone,''),'[^0-9]','','g') END=digits;
 IF coalesce(cardinality(matches),0)=0 THEN RAISE EXCEPTION 'Telefon tidak ditemui. Gunakan nombor telefon terkini dalam rekod ahli.'; END IF;
 IF cardinality(matches)<>1 THEN RAISE EXCEPTION 'Telefon dikongsi beberapa rekod ahli. Semakan manual diperlukan.'; END IF;
 RETURN matches[1];
END;
$$;
REVOKE ALL ON FUNCTION public.shk_member_by_repair_phone(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.lookup_repair_member_by_phone(p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid; result jsonb;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 mid:=public.shk_member_by_repair_phone(p_phone);
 SELECT jsonb_build_object('member_id',id,'member_name',member_name,'phone_last4',right(regexp_replace(phone,'[^0-9]','','g'),4)) INTO result FROM public.members WHERE id=mid;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.lookup_repair_member_by_phone(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lookup_repair_member_by_phone(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_member_update_by_phone(p_update_id uuid,p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid; u public.dependant_updates%rowtype;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 SELECT * INTO u FROM public.dependant_updates WHERE id=p_update_id FOR UPDATE;
 IF NOT FOUND OR u.status<>'approved' THEN RAISE EXCEPTION 'Pemulihan ini hanya untuk permohonan lama yang diluluskan.'; END IF;
 mid:=public.shk_member_by_repair_phone(p_phone);
 PERFORM id FROM public.members WHERE id=mid FOR UPDATE;
 -- Recheck after locking, in case the member phone changed during confirmation.
 IF public.shk_member_by_repair_phone(p_phone) IS DISTINCT FROM mid THEN RAISE EXCEPTION 'Padanan telefon telah berubah. Semak semula.'; END IF;
 IF u.applied_at IS NOT NULL AND u.member_id IS DISTINCT FROM mid THEN RAISE EXCEPTION 'Permohonan sudah disimpan untuk ahli lain. Tidak boleh dipindahkan.'; END IF;
 UPDATE public.dependant_updates SET member_id=mid WHERE id=p_update_id AND applied_at IS NULL;
 RETURN public.approve_member_update(p_update_id,true,NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.repair_member_update_by_phone(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.repair_member_update_by_phone(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
