BEGIN;
ALTER TABLE public.dependant_updates ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id);
ALTER TABLE public.dependant_updates ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE public.dependant_update_items ADD COLUMN IF NOT EXISTS target_dependant_id uuid;
ALTER TABLE public.dependant_update_items ADD COLUMN IF NOT EXISTS applied_dependant_id uuid;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS residence_type text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS location_url text;
CREATE TABLE IF NOT EXISTS public.member_update_audit (
 update_id uuid PRIMARY KEY REFERENCES public.dependant_updates(id),
 member_id uuid NOT NULL REFERENCES public.members(id),
 before_member jsonb NOT NULL,
 before_dependants jsonb NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_update_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read member update audit" ON public.member_update_audit;
CREATE POLICY "Admins read member update audit" ON public.member_update_audit FOR SELECT TO authenticated USING (public.is_admin());
GRANT SELECT ON public.member_update_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_member_for_update(p_member_name text,p_identifier text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid; m public.members%rowtype; matches integer;
BEGIN
 IF nullif(trim(p_identifier),'') IS NULL THEN RAISE EXCEPTION 'Masukkan telefon atau IC ahli.'; END IF;
 mid := public.shk_resolve_member_link(p_identifier,NULL);
 IF mid IS NULL THEN RAISE EXCEPTION 'Ahli tidak ditemui atau padanan berganda. Semak telefon/IC terkini.'; END IF;
 SELECT * INTO m FROM public.members WHERE id=mid;
 -- The typed name is a hint only. A unique phone/IC selects the member.

 IF m.membership_status<>'aktif' THEN RAISE EXCEPTION 'Rekod ahli tidak aktif. Hubungi pentadbir.'; END IF;
 RETURN jsonb_build_object('member_id',m.id,'member_name',m.member_name,'member_no',m.member_no,
  'dependants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'dependant_name',d.dependant_name,
    'masked_ic',CASE WHEN nullif(d.dependant_ic,'') IS NULL THEN '' ELSE '******' || right(d.dependant_ic,4) END,
    'gender',d.gender,'age',d.age,'relationship',d.relationship) ORDER BY d.position_no NULLS LAST,d.dependant_name)
    FROM public.member_dependants d WHERE d.member_id=m.id),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.lookup_member_for_update(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_member_for_update(text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.approve_member_update(p_update_id uuid,p_repair boolean DEFAULT false,p_member_no text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u public.dependant_updates%rowtype; m public.members%rowtype; i public.dependant_update_items%rowtype;
 mid uuid; did uuid; matched integer; old_deps jsonb; change_count integer:=0; desired_count integer;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 SELECT * INTO u FROM public.dependant_updates WHERE id=p_update_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Permohonan tidak ditemui.'; END IF;
 IF u.applied_at IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.member_update_audit a WHERE a.update_id=u.id) THEN RAISE EXCEPTION 'Penanda simpanan tiada rekod audit. Semak manual.'; END IF;
  RETURN jsonb_build_object('status','already_applied');
 END IF;
 IF u.status='approved' AND NOT p_repair THEN RAISE EXCEPTION 'Gunakan pemulihan untuk permohonan lama diluluskan.'; END IF;
 IF u.status NOT IN ('pending','reviewed','approved') THEN RAISE EXCEPTION 'Permohonan telah ditolak.'; END IF;
 IF nullif(trim(p_member_no),'') IS NOT NULL THEN
  IF NOT p_repair THEN RAISE EXCEPTION 'Padanan manual hanya untuk pemulihan.'; END IF;
  SELECT count(*),(array_agg(x.id))[1] INTO matched,mid FROM public.members x WHERE trim(x.member_no)=trim(p_member_no);
  IF matched<>1 THEN RAISE EXCEPTION 'Nombor ahli tidak sepadan secara unik.'; END IF;
 ELSE mid:=coalesce(u.member_id,public.shk_resolve_member_link(u.member_identifier,NULL)); END IF;
 IF mid IS NULL THEN RAISE EXCEPTION 'Tiada padanan telefon/IC yang unik. Pentadbir perlu sahkan ahli asal.'; END IF;
 SELECT * INTO m FROM public.members WHERE id=mid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rekod ahli tiada.'; END IF;
 IF m.membership_status<>'aktif' THEN RAISE EXCEPTION 'Ahli tidak aktif; semakan manual diperlukan.'; END IF;
 -- A newly submitted member_id is a hint, not authorization: require the identifier to match.
 IF NOT p_repair AND public.shk_resolve_member_link(u.member_identifier,NULL) IS DISTINCT FROM mid THEN
  RAISE EXCEPTION 'Telefon/IC ahli telah berubah. Semak semula sebelum meluluskan.';
 END IF;
 IF p_repair AND u.update_action='Kemaskini Maklumat Diri' AND EXISTS(
 SELECT 1 FROM public.dependant_updates later WHERE later.status='approved' AND later.update_action='Kemaskini Maklumat Diri'
 AND later.created_at>u.created_at AND coalesce(later.member_id,public.shk_resolve_member_link(later.member_identifier,NULL))=mid
 ) THEN RAISE EXCEPTION 'Ada kemaskini diri lebih baharu. Semak sejarah; jangan ulang permohonan lama.'; END IF;
 IF p_repair AND u.update_action<>'Kemaskini Maklumat Diri' AND EXISTS(
 SELECT 1 FROM public.dependant_updates later WHERE later.status='approved' AND later.update_action<>'Kemaskini Maklumat Diri'
 AND later.created_at>u.created_at AND (coalesce(later.member_id,public.shk_resolve_member_link(later.member_identifier,NULL))=mid OR lower(trim(later.member_name))=lower(trim(u.member_name)))
 ) THEN RAISE EXCEPTION 'Ada permohonan tanggungan lebih baharu. Semak sejarah sebelum pulihkan.'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) INTO old_deps FROM public.member_dependants d WHERE d.member_id=mid;
 INSERT INTO public.member_update_audit(update_id,member_id,before_member,before_dependants)
 VALUES(u.id,mid,to_jsonb(m),old_deps);
 IF u.update_action='Kemaskini Maklumat Diri' THEN
  IF coalesce(nullif(trim(u.new_name),''),nullif(trim(u.new_phone),''),nullif(trim(u.new_ic),''),nullif(trim(u.new_address),''),nullif(trim(u.new_residence_type),'')) IS NULL THEN
   RAISE EXCEPTION 'Tiada maklumat baharu untuk disimpan.';
  END IF;
  IF nullif(trim(u.new_phone),'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.members x WHERE x.id<>mid AND regexp_replace(coalesce(x.phone,''),'[^0-9]','','g')=regexp_replace(u.new_phone,'[^0-9]','','g')) THEN
   RAISE EXCEPTION 'Telefon baharu digunakan oleh ahli lain; semak manual.';
  END IF;
  IF nullif(trim(u.new_ic),'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.members x WHERE x.id<>mid AND regexp_replace(coalesce(x.ic_no,''),'[^0-9]','','g')=regexp_replace(u.new_ic,'[^0-9]','','g')) THEN
   RAISE EXCEPTION 'IC baharu digunakan oleh ahli lain; semak manual.';
  END IF;
  UPDATE public.members SET member_name=coalesce(nullif(trim(u.new_name),''),member_name),
    phone=coalesce(nullif(trim(u.new_phone),''),phone),ic_no=coalesce(nullif(trim(u.new_ic),''),ic_no),
    address=coalesce(nullif(trim(u.new_address),''),address),residence_type=coalesce(nullif(trim(u.new_residence_type),''),residence_type),
    location_url=coalesce(nullif(trim(u.location_url),''),location_url) WHERE id=mid;
 ELSE
  IF u.update_action NOT IN ('Tambah Tanggungan','Kurangkan Tanggungan','Kemaskini Maklumat Tanggungan') THEN RAISE EXCEPTION 'Jenis permohonan tidak sah.'; END IF;
  FOR i IN SELECT * FROM public.dependant_update_items WHERE update_id=u.id ORDER BY created_at,id LOOP
   did:=NULL;
   IF i.item_status NOT IN ('Tambah','Buang','Kemaskini') THEN RAISE EXCEPTION 'Status tanggungan tidak sah.'; END IF;
   IF i.item_status='Tambah' THEN
    IF nullif(trim(i.dependant_name),'') IS NULL THEN RAISE EXCEPTION 'Nama tanggungan diperlukan.'; END IF;
    -- Recover an old insert only when it is already linked to this same submission.
    SELECT count(*),(array_agg(d.id))[1] INTO matched,did FROM public.member_dependants d WHERE d.member_id=mid AND d.source_submission_id=u.id
      AND lower(trim(d.dependant_name))=lower(trim(i.dependant_name))
      AND coalesce(d.dependant_ic,'')=coalesce(i.dependant_ic,'');
    IF matched>1 THEN RAISE EXCEPTION 'Rekod tanggungan berganda; semak manual.'; END IF;
    IF matched=0 THEN
     IF nullif(trim(i.dependant_ic),'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.member_dependants d WHERE d.member_id=mid AND regexp_replace(d.dependant_ic,'[^0-9A-Za-z]','','g')=regexp_replace(i.dependant_ic,'[^0-9A-Za-z]','','g')) THEN
      RAISE EXCEPTION 'IC tanggungan sudah wujud; gunakan kemaskini, bukan tambah.';
     END IF;
     INSERT INTO public.member_dependants(member_id,member_no,member_name,dependant_name,dependant_ic,gender,age,relationship,source_sheet,source_submission_id)
     VALUES(mid,m.member_no,m.member_name,i.dependant_name,i.dependant_ic,i.gender,i.age,i.relationship,'WEBSITE',u.id) RETURNING id INTO did;
    END IF;
   ELSE
    IF i.target_dependant_id IS NOT NULL THEN
     SELECT d.id INTO did FROM public.member_dependants d WHERE d.id=i.target_dependant_id AND d.member_id=mid FOR UPDATE;
    ELSE
     SELECT count(*),(array_agg(d.id))[1] INTO matched,did FROM public.member_dependants d WHERE d.member_id=mid AND (
      (nullif(trim(i.dependant_ic),'') IS NOT NULL AND regexp_replace(d.dependant_ic,'[^0-9A-Za-z]','','g')=regexp_replace(i.dependant_ic,'[^0-9A-Za-z]','','g'))
      OR (nullif(trim(i.dependant_ic),'') IS NULL AND lower(trim(d.dependant_name))=lower(trim(i.dependant_name))));
     IF matched<>1 THEN RAISE EXCEPTION 'Tanggungan lama tidak dapat dipadankan secara unik. Semak manual.'; END IF;
    END IF;
    IF did IS NULL THEN RAISE EXCEPTION 'Tanggungan tidak lagi wujud atau bukan milik ahli ini.'; END IF;
    IF i.item_status='Buang' THEN DELETE FROM public.member_dependants WHERE id=did AND member_id=mid;
    ELSE
     UPDATE public.member_dependants SET dependant_name=coalesce(nullif(trim(i.dependant_name),''),dependant_name),
      dependant_ic=coalesce(nullif(trim(i.dependant_ic),''),dependant_ic),gender=coalesce(nullif(i.gender,''),gender),
      age=coalesce(i.age,age),relationship=coalesce(nullif(trim(i.relationship),''),relationship) WHERE id=did AND member_id=mid;
    END IF;
   END IF;
   IF i.item_status='Buang' THEN
    IF EXISTS(SELECT 1 FROM public.member_dependants d WHERE d.id=did) THEN RAISE EXCEPTION 'Pembuangan tanggungan tidak disimpan. Kelulusan dibatalkan.'; END IF;
   ELSE
    IF NOT EXISTS(SELECT 1 FROM public.member_dependants d WHERE d.id=did AND d.member_id=mid
     AND (nullif(trim(i.dependant_name),'') IS NULL OR trim(d.dependant_name) IS NOT DISTINCT FROM trim(i.dependant_name))
     AND (nullif(trim(i.dependant_ic),'') IS NULL OR trim(d.dependant_ic) IS NOT DISTINCT FROM trim(i.dependant_ic))
     AND (nullif(trim(i.gender),'') IS NULL OR d.gender IS NOT DISTINCT FROM i.gender)
     AND (i.age IS NULL OR d.age IS NOT DISTINCT FROM i.age)
     AND (nullif(trim(i.relationship),'') IS NULL OR trim(d.relationship) IS NOT DISTINCT FROM trim(i.relationship))) THEN
     RAISE EXCEPTION 'Maklumat tanggungan tersimpan tidak sepadan dengan permohonan. Kelulusan dibatalkan.';
    END IF;
   END IF;
   UPDATE public.dependant_update_items SET applied_dependant_id=did WHERE id=i.id;
   change_count:=change_count+1;
  END LOOP;
  IF change_count=0 THEN RAISE EXCEPTION 'Tiada baris tanggungan untuk dikemaskini.'; END IF;
  SELECT count(*) INTO desired_count FROM public.member_dependants WHERE member_id=mid;
  UPDATE public.members SET dependant_count=desired_count WHERE id=mid;
  IF NOT EXISTS(SELECT 1 FROM public.members x WHERE x.id=mid AND x.dependant_count=desired_count) THEN
   RAISE EXCEPTION 'Jumlah tanggungan tidak berjaya disimpan. Kelulusan dibatalkan.';
  END IF;
 END IF;
 IF u.update_action='Kemaskini Maklumat Diri' AND NOT EXISTS(SELECT 1 FROM public.members x WHERE x.id=mid
  AND (nullif(trim(u.new_name),'') IS NULL OR trim(x.member_name) IS NOT DISTINCT FROM trim(u.new_name))
  AND (nullif(trim(u.new_phone),'') IS NULL OR trim(x.phone) IS NOT DISTINCT FROM trim(u.new_phone))
  AND (nullif(trim(u.new_ic),'') IS NULL OR trim(x.ic_no) IS NOT DISTINCT FROM trim(u.new_ic))
  AND (nullif(trim(u.new_address),'') IS NULL OR trim(x.address) IS NOT DISTINCT FROM trim(u.new_address))
  AND (nullif(trim(u.new_residence_type),'') IS NULL OR x.residence_type IS NOT DISTINCT FROM u.new_residence_type)) THEN
  RAISE EXCEPTION 'Maklumat ahli tersimpan tidak sepadan. Kelulusan dibatalkan.';
 END IF;
 UPDATE public.dependant_updates SET member_id=mid,status='approved',applied_at=now() WHERE id=u.id;
 IF NOT EXISTS(SELECT 1 FROM public.dependant_updates x WHERE x.id=u.id AND x.status='approved' AND x.applied_at IS NOT NULL AND x.member_id=mid) THEN
  RAISE EXCEPTION 'Status simpanan gagal disahkan. Semua perubahan dibatalkan.';
 END IF;
 RETURN jsonb_build_object('status','applied','member_id',mid,'changed_items',change_count);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_member_update(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_member_update(uuid,boolean,text) TO authenticated;

-- SQL Editor batch repair: preserves failures as a report, never guesses by name alone.
CREATE OR REPLACE FUNCTION public.repair_approved_member_updates()
RETURNS TABLE(update_id uuid,member_name text,result text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u record; r jsonb; mid uuid;
BEGIN
 -- SQL Editor runs as postgres; web sessions still require an admin.
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 FOR u IN SELECT d.* FROM public.dependant_updates d WHERE d.status='approved' AND d.applied_at IS NULL ORDER BY d.created_at,d.id LOOP
  update_id:=u.id;member_name:=u.member_name;
  BEGIN
   mid:=coalesce(u.member_id,public.shk_resolve_member_link(u.member_identifier,NULL));
   IF mid IS NULL THEN RAISE EXCEPTION 'Perlu padanan ahli manual: telefon/IC rujukan tidak ditemui.'; END IF;
   -- Do not replay an older self-update over a newer approved request for the same member.
   IF u.update_action='Kemaskini Maklumat Diri' AND EXISTS(
    SELECT 1 FROM public.dependant_updates later WHERE later.status='approved' AND later.update_action='Kemaskini Maklumat Diri'
    AND later.created_at>u.created_at AND coalesce(later.member_id,public.shk_resolve_member_link(later.member_identifier,NULL))=mid
   ) THEN result:='SKIP: ada kemaskini diri lebih baharu; semak manual'; RETURN NEXT; CONTINUE; END IF;
   -- Do not replay older dependant changes over a more recent approved request.
   IF u.update_action<>'Kemaskini Maklumat Diri' AND EXISTS(
    SELECT 1 FROM public.dependant_updates later WHERE later.status='approved' AND later.update_action<>'Kemaskini Maklumat Diri'
    AND later.created_at>u.created_at AND (coalesce(later.member_id,public.shk_resolve_member_link(later.member_identifier,NULL))=mid
      OR lower(trim(later.member_name))=lower(trim(u.member_name)))
   ) THEN result:='SKIP: ada kemaskini tanggungan lebih baharu; semak manual'; RETURN NEXT; CONTINUE; END IF;
   r:=public.approve_member_update(u.id,true);result:=r->>'status';
  EXCEPTION WHEN OTHERS THEN result:='SEMAK: '||SQLERRM;
  END;
  RETURN NEXT;
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.repair_approved_member_updates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.repair_approved_member_updates() TO authenticated;
CREATE OR REPLACE FUNCTION public.shk_guard_update_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN
  NEW.status:='pending'; NEW.applied_at:=NULL;
  NEW.member_id:=public.shk_resolve_member_link(NEW.member_identifier,NULL);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.shk_guard_update_submission() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS shk_guard_update_submission ON public.dependant_updates;
CREATE TRIGGER shk_guard_update_submission BEFORE INSERT ON public.dependant_updates FOR EACH ROW EXECUTE FUNCTION public.shk_guard_update_submission();

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

CREATE OR REPLACE FUNCTION public.submit_member_update(p_payload jsonb,p_items jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE identity jsonb; mid uuid; uid uuid:=gen_random_uuid(); item jsonb; action text:=p_payload->>'update_action'; expected_status text; target_id uuid; seen uuid[]:='{}';
BEGIN
 IF action NOT IN ('Kemaskini Maklumat Diri','Tambah Tanggungan','Kurangkan Tanggungan','Kemaskini Maklumat Tanggungan') OR action IS NULL THEN RAISE EXCEPTION 'Jenis permohonan tidak sah.'; END IF;
 IF action<>'Kemaskini Maklumat Diri' AND nullif(trim(p_payload->>'member_name'),'') IS NULL THEN RAISE EXCEPTION 'Nama ahli diperlukan.'; END IF;
 identity:=public.lookup_member_for_update(p_payload->>'member_name',p_payload->>'member_identifier');
 mid:=(identity->>'member_id')::uuid;
 IF jsonb_typeof(p_items)<>'array' OR p_items IS NULL THEN RAISE EXCEPTION 'Senarai tanggungan tidak sah.'; END IF;
 IF jsonb_array_length(p_items)>30 THEN RAISE EXCEPTION 'Maksimum 30 perubahan setiap permohonan.'; END IF;
 IF action<>'Kemaskini Maklumat Diri' AND jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Pilih sekurang-kurangnya satu tanggungan.'; END IF;
 IF action='Kemaskini Maklumat Diri' AND coalesce(nullif(trim(p_payload->>'new_name'),''),nullif(trim(p_payload->>'new_phone'),''),nullif(trim(p_payload->>'new_ic'),''),nullif(trim(p_payload->>'new_address'),''),nullif(trim(p_payload->>'new_residence_type'),'')) IS NULL THEN RAISE EXCEPTION 'Isi maklumat baharu dahulu.'; END IF;
 INSERT INTO public.dependant_updates(id,member_id,member_name,member_identifier,phone,update_action,new_name,new_phone,new_ic,new_address,new_residence_type,location_url)
 VALUES(uid,mid,identity->>'member_name',p_payload->>'member_identifier',p_payload->>'member_identifier',action,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_name'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_phone'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_ic'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_address'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_residence_type'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'location_url'),'') END);
 IF action<>'Kemaskini Maklumat Diri' THEN
 expected_status:=CASE action WHEN 'Tambah Tanggungan' THEN 'Tambah' WHEN 'Kurangkan Tanggungan' THEN 'Buang' ELSE 'Kemaskini' END;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  target_id:=nullif(item->>'target_dependant_id','')::uuid;
  IF expected_status<>'Tambah' THEN
   IF target_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.member_dependants d WHERE d.id=target_id AND d.member_id=mid) THEN RAISE EXCEPTION 'Pilih tanggungan terkini milik ahli ini.'; END IF;
   IF target_id=ANY(seen) THEN RAISE EXCEPTION 'Tanggungan yang sama dipilih dua kali.'; END IF;
   seen:=array_append(seen,target_id);
  ELSE
   IF target_id IS NOT NULL OR nullif(trim(item->>'dependant_name'),'') IS NULL THEN RAISE EXCEPTION 'Nama tanggungan baharu diperlukan.'; END IF;
  END IF;
  IF (item->>'age')::integer<0 THEN RAISE EXCEPTION 'Umur tidak boleh negatif.'; END IF;
  INSERT INTO public.dependant_update_items(update_id,target_dependant_id,dependant_name,dependant_ic,gender,age,relationship,item_status)
  VALUES(uid,target_id,nullif(trim(item->>'dependant_name'),''),nullif(trim(item->>'dependant_ic'),''),nullif(item->>'gender',''),(item->>'age')::integer,nullif(trim(item->>'relationship'),''),expected_status);
 END LOOP;
 END IF;
 RETURN uid;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_member_update(jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_member_update(jsonb,jsonb) TO anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
