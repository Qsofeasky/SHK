BEGIN;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS fee_type text NOT NULL DEFAULT 'annual' CHECK(fee_type IN ('annual','registration','mixed'));
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS allocated_at timestamptz;
ALTER TABLE public.member_yearly_payments ADD COLUMN IF NOT EXISTS fee_type text NOT NULL DEFAULT 'annual' CHECK(fee_type IN ('annual','registration'));
ALTER TABLE public.member_yearly_payments ADD COLUMN IF NOT EXISTS annual_due numeric(10,2);
ALTER TABLE public.member_yearly_payments ADD COLUMN IF NOT EXISTS allocation_version text NOT NULL DEFAULT 'legacy';
CREATE UNIQUE INDEX IF NOT EXISTS shk_fee_allocation_once ON public.member_yearly_payments(source_submission_id,fee_type,payment_year) WHERE allocation_version='v2' AND source_submission_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.shk_fee_due(p_ic text,p_kind text,p_year integer,p_as_of date DEFAULT (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE d text:=regexp_replace(coalesce(p_ic,''),'[^0-9]','','g'); born date; birth_year integer; ref date; age_years integer;
BEGIN
 IF length(d)<>12 THEN RAISE EXCEPTION 'Lengkapkan IC ahli yang sah sebelum mengira yuran.'; END IF;
 IF p_kind NOT IN ('annual','registration') OR p_kind IS NULL THEN RAISE EXCEPTION 'Jenis yuran tidak sah.'; END IF;
 birth_year:=(extract(year FROM p_as_of)::integer/100)*100+substr(d,1,2)::integer;
 IF birth_year>extract(year FROM p_as_of)::integer THEN birth_year:=birth_year-100; END IF;
 BEGIN born:=make_date(birth_year,substr(d,3,2)::integer,substr(d,5,2)::integer);
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Tarikh lahir dalam IC tidak sah. Semak IC ahli.'; END;
 IF born>p_as_of THEN born:=(born-interval '100 years')::date; END IF;
 ref:=(p_as_of+make_interval(years=>p_year-extract(year FROM p_as_of)::integer))::date;
 age_years:=extract(year FROM age(ref,born))::integer;
 RETURN CASE WHEN p_kind='registration' THEN CASE WHEN age_years>=60 THEN 30 ELSE 50 END
 ELSE CASE WHEN age_years>=60 THEN 20 ELSE 30 END END;
END;
$$;
REVOKE ALL ON FUNCTION public.shk_fee_due(text,text,integer,date) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.shk_fee_plan(p_member_id uuid,p_amount numeric,p_year integer,p_kind text,p_as_of date)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE m public.members%rowtype; remaining numeric:=p_amount; due numeric; paid numeric; portion numeric; y integer:=p_year;
 reg_legacy numeric; lines jsonb:='[]'::jsonb;
BEGIN
 IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>100000 THEN RAISE EXCEPTION 'Jumlah bayaran mesti positif dan maksimum dua tempat perpuluhan.'; END IF;
 IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Tahun bayaran tidak sah.'; END IF;
 IF p_kind NOT IN ('annual','registration','mixed') OR p_kind IS NULL THEN RAISE EXCEPTION 'Pilih jenis yuran.'; END IF;
 SELECT * INTO m FROM public.members WHERE id=p_member_id;
 IF NOT FOUND OR m.membership_status<>'aktif' THEN RAISE EXCEPTION 'Rekod ahli aktif tidak ditemui.'; END IF;
 -- IC is required even when the legacy registration was already paid.
 due:=public.shk_fee_due(m.ic_no,'annual',p_year,p_as_of);
 IF p_kind IN ('registration','mixed') THEN
  due:=public.shk_fee_due(m.ic_no,'registration',p_year,p_as_of);
  reg_legacy:=coalesce(m.registration_member_amount,0)+coalesce(m.registration_dependant_amount,0);
  SELECT coalesce(sum(amount),0) INTO paid FROM public.member_yearly_payments WHERE member_id=m.id AND fee_type='registration';
  IF reg_legacy>0 THEN due:=0; ELSE due:=greatest(0,due-paid); END IF;
  IF p_kind='registration' AND (due=0 OR remaining>due) THEN RAISE EXCEPTION 'Pendaftaran sudah cukup atau jumlah melebihi baki pendaftaran RM%. Pilih Pendaftaran + Yuran Ahli untuk lebihan yuran ahli.',due; END IF;
  portion:=least(remaining,due);
  IF portion>0 THEN lines:=lines||jsonb_build_array(jsonb_build_object('fee_type','registration','year',p_year,'amount',portion,'due',public.shk_fee_due(m.ic_no,'registration',p_year,p_as_of)));remaining:=remaining-portion;END IF;
 END IF;
 WHILE remaining>0 LOOP
  IF y>p_year+100 THEN RAISE EXCEPTION 'Bayaran melangkaui 100 tahun; semak jumlah.'; END IF;
  SELECT coalesce(sum(amount),0),max(annual_due) INTO paid,due FROM public.member_yearly_payments WHERE member_id=m.id AND payment_year=y AND fee_type='annual';
  due:=coalesce(due,public.shk_fee_due(m.ic_no,'annual',y,p_as_of));
  portion:=least(remaining,greatest(0,due-paid));
  IF portion>0 THEN lines:=lines||jsonb_build_array(jsonb_build_object('fee_type','annual','year',y,'amount',portion,'due',due));remaining:=remaining-portion; END IF;
  y:=y+1;
 END LOOP;
 RETURN jsonb_build_object('member_id',m.id,'member_name',m.member_name,'total',p_amount,'allocations',lines);
END;
$$;
REVOKE ALL ON FUNCTION public.shk_fee_plan(uuid,numeric,integer,text,date) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.preview_fee_payment(p_payment_id uuid,p_fee_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.payments%rowtype; mid uuid;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 SELECT * INTO p FROM public.payments WHERE id=p_payment_id;
 IF NOT FOUND OR p.status<>'pending' THEN RAISE EXCEPTION 'Bayaran bukan berstatus menunggu.'; END IF;
 mid:=coalesce(p.member_id,public.shk_resolve_member_link(p.payer_identifier,NULL));
 IF mid IS NULL THEN RAISE EXCEPTION 'Telefon/IC pembayar tidak sepadan secara unik dengan ahli. Semak rekod ahli.'; END IF;
 RETURN public.shk_fee_plan(mid,p.amount,p.payment_year,p_fee_type,(coalesce(p.created_at,now()) AT TIME ZONE 'Asia/Kuala_Lumpur')::date);
END;
$$;
REVOKE ALL ON FUNCTION public.preview_fee_payment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preview_fee_payment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.shk_fee_receipt(p_year integer)
RETURNS text LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('shk_receipt_'||p_year::text));
 SELECT coalesce(max((regexp_match(receipt_no,'^SHK\s*-\s*([0-9]+)\/'||p_year::text||'$','i'))[1]::integer),0)+1 INTO n
 FROM (SELECT receipt_no FROM public.payments UNION ALL SELECT receipt_no FROM public.member_yearly_payments UNION ALL SELECT receipt_no FROM public.non_member_donations) receipts;
 RETURN 'SHK-'||lpad(n::text,greatest(4,length(n::text)),'0')||'/'||p_year::text;
END;
$$;
REVOKE ALL ON FUNCTION public.shk_fee_receipt(integer) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.approve_fee_payment(p_payment_id uuid,p_fee_type text,p_bank_ref text DEFAULT NULL,p_expected_allocations jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.payments%rowtype; m public.members%rowtype; mid uuid; plan jsonb; line jsonb; receipt text; total_alloc numeric;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 SELECT * INTO p FROM public.payments WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bayaran tidak ditemui.'; END IF;
 IF p.allocated_at IS NOT NULL THEN
  IF p.fee_type IS DISTINCT FROM p_fee_type THEN RAISE EXCEPTION 'Bayaran sudah diagih mengikut jenis yuran lain.'; END IF;
  RETURN jsonb_build_object('status','already_allocated','receipt_no',p.receipt_no);
 END IF;
 IF p.status<>'pending' OR EXISTS(SELECT 1 FROM public.member_yearly_payments WHERE source_submission_id=p.id) THEN RAISE EXCEPTION 'Bayaran telah disahkan/diagih sebelum ini. Semak sebelum mengelakkan kiraan berganda.'; END IF;
 mid:=coalesce(p.member_id,public.shk_resolve_member_link(p.payer_identifier,NULL));
 SELECT * INTO m FROM public.members WHERE id=mid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ahli tidak dapat dipadankan secara unik.'; END IF;
 plan:=public.shk_fee_plan(mid,p.amount,p.payment_year,p_fee_type,(coalesce(p.created_at,now()) AT TIME ZONE 'Asia/Kuala_Lumpur')::date);
 IF p_expected_allocations IS NOT NULL AND plan->'allocations' IS DISTINCT FROM p_expected_allocations THEN
  RAISE EXCEPTION 'Agihan telah berubah kerana rekod bayaran terkini. Semak pratonton semula sebelum mengesahkan.';
 END IF;
 receipt:=coalesce(nullif(trim(p.receipt_no),''),public.shk_fee_receipt(p.payment_year));
 FOR line IN SELECT value FROM jsonb_array_elements(plan->'allocations') LOOP
  INSERT INTO public.member_yearly_payments(member_id,member_no,member_name,payment_year,amount,receipt_no,source_sheet,source_submission_id,fee_type,annual_due,allocation_version)
  VALUES(mid,m.member_no,m.member_name,(line->>'year')::integer,(line->>'amount')::numeric,receipt,'WEBSITE-FEE-V2',p.id,line->>'fee_type',CASE WHEN line->>'fee_type'='annual' THEN (line->>'due')::numeric END,'v2');
  IF NOT EXISTS(SELECT 1 FROM public.member_yearly_payments a WHERE a.source_submission_id=p.id AND a.member_id=mid AND a.fee_type=line->>'fee_type'
    AND a.payment_year=(line->>'year')::integer AND a.amount=(line->>'amount')::numeric AND a.allocation_version='v2') THEN
   RAISE EXCEPTION 'Butiran agihan tidak berjaya disimpan; semua perubahan dibatalkan.';
  END IF;
 END LOOP;
 SELECT coalesce(sum(amount),0) INTO total_alloc FROM public.member_yearly_payments WHERE source_submission_id=p.id AND allocation_version='v2';
 IF total_alloc<>p.amount THEN RAISE EXCEPTION 'Jumlah agihan tidak sepadan; semua perubahan dibatalkan.'; END IF;
 UPDATE public.payments SET member_id=mid,fee_type=p_fee_type,status='verified',allocated_at=now(),receipt_no=receipt,bank_statement_ref=coalesce(p_bank_ref,bank_statement_ref),apply_excess_to_next_year=true WHERE id=p.id;
 IF NOT EXISTS(SELECT 1 FROM public.payments verified WHERE verified.id=p.id AND verified.status='verified' AND verified.allocated_at IS NOT NULL) THEN RAISE EXCEPTION 'Pengesahan bayaran gagal disimpan.'; END IF;
 RETURN plan||jsonb_build_object('status','allocated','receipt_no',receipt);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_fee_payment(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_fee_payment(uuid,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_fee_payment(p_payer_name text,p_payer_identifier text,p_payment_method text,p_payment_year integer,p_amount numeric,p_fee_type text DEFAULT 'annual',p_bank_statement_ref text DEFAULT NULL,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.payments%rowtype; official_receipt text;
BEGIN
 IF p_fee_type NOT IN ('annual','registration','mixed') OR p_fee_type IS NULL THEN RAISE EXCEPTION 'Jenis yuran tidak sah.'; END IF;
 IF nullif(trim(p_payer_name),'') IS NULL OR nullif(trim(p_payer_identifier),'') IS NULL THEN RAISE EXCEPTION 'Nama dan telefon pembayar diperlukan.'; END IF;
 IF p_payment_year NOT BETWEEN 2000 AND 2100 OR p_payment_year IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>100000 THEN RAISE EXCEPTION 'Semak tahun dan jumlah bayaran.'; END IF;
 official_receipt:=public.shk_fee_receipt(p_payment_year);
 INSERT INTO public.payments(payer_name,payer_identifier,payment_method,payment_year,amount,receipt_no,bank_statement_ref,note,fee_type,apply_excess_to_next_year)
 VALUES(trim(p_payer_name),trim(p_payer_identifier),p_payment_method,p_payment_year,p_amount,official_receipt,p_bank_statement_ref,p_note,p_fee_type,true) RETURNING * INTO r;
 RETURN jsonb_build_object('found',true,'status',r.status,'payer_name',r.payer_name,'payment_method',r.payment_method,'payment_year',r.payment_year,'amount',r.amount,'receipt_no',r.receipt_no,'created_at',r.created_at,'fee_type',r.fee_type);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_fee_payment(text,text,text,integer,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_fee_payment(text,text,text,integer,numeric,text,text,text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.shk_safe_fee_due(p_ic text,p_kind text,p_year integer)
RETURNS numeric LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RETURN public.shk_fee_due(p_ic,p_kind,p_year); EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
$$;
REVOKE ALL ON FUNCTION public.shk_safe_fee_due(text,text,integer) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_fee_overview(p_year integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 WITH ledger AS (
  SELECT member_id,sum(amount) FILTER(WHERE fee_type='annual' AND payment_year=p_year) AS annual_paid,
   max(annual_due) FILTER(WHERE fee_type='annual' AND payment_year=p_year) AS annual_due,
   sum(amount) FILTER(WHERE fee_type='registration') AS registration_paid,
   sum(amount) FILTER(WHERE fee_type='registration' AND payment_year=p_year) AS registration_paid_year
  FROM public.member_yearly_payments WHERE member_id IS NOT NULL GROUP BY member_id
 ), member_rows AS (
  SELECT m.id,m.member_name,m.member_no,m.email,
   coalesce(l.annual_paid,0) AS annual_paid,coalesce(l.annual_due,public.shk_safe_fee_due(m.ic_no,'annual',p_year)) AS annual_due,
   coalesce(l.registration_paid,0)+coalesce(m.registration_member_amount,0)+coalesce(m.registration_dependant_amount,0) AS registration_paid,
   public.shk_safe_fee_due(m.ic_no,'registration',p_year) AS registration_due,
   coalesce(m.registration_member_amount,0)+coalesce(m.registration_dependant_amount,0)>0 AS legacy_registration_paid,
   exists(SELECT 1 FROM public.payments p WHERE p.member_id=m.id AND p.status='pending') AS pending_payment
  FROM public.members m LEFT JOIN ledger l ON l.member_id=m.id WHERE m.membership_status='aktif'
 ), statuses AS (
  SELECT *,CASE WHEN annual_due IS NULL THEN 'needs_ic' WHEN annual_paid>=annual_due THEN 'paid' WHEN annual_paid>0 THEN 'partial' ELSE 'unpaid' END AS annual_status,
  CASE WHEN legacy_registration_paid THEN 'paid' WHEN registration_due IS NULL THEN 'needs_ic' WHEN registration_paid>=registration_due THEN 'paid' WHEN registration_paid>0 THEN 'partial' ELSE 'unpaid' END AS registration_status
  FROM member_rows
 ) SELECT jsonb_build_object('year',p_year,'members',coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.member_name),'[]'::jsonb)) INTO result FROM statuses s;
 RETURN result||jsonb_build_object('annual_total',coalesce((SELECT sum(amount) FROM public.member_yearly_payments WHERE payment_year=p_year AND fee_type='annual'),0),
  'registration_total',coalesce((SELECT sum(amount) FROM public.member_yearly_payments WHERE payment_year=p_year AND fee_type='registration'),0)+
    coalesce((SELECT sum(coalesce(registration_member_amount,0)+coalesce(registration_dependant_amount,0)) FROM public.members WHERE registration_year=p_year::text),0),
  'year_totals',coalesce((SELECT jsonb_agg(t ORDER BY payment_year) FROM (
    SELECT payment_year,sum(amount) FILTER(WHERE fee_type='annual') AS annual_total,
      sum(amount) FILTER(WHERE fee_type='registration') AS registration_total
    FROM (SELECT payment_year,fee_type,amount FROM public.member_yearly_payments
      UNION ALL SELECT registration_year::integer,'registration',coalesce(registration_member_amount,0)+coalesce(registration_dependant_amount,0)
      FROM public.members WHERE registration_year ~ '^[0-9]{4}$') source
    GROUP BY payment_year) t),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_fee_overview(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_fee_overview(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_payment_history(search_text text)
RETURNS TABLE(found boolean,status text,member_name text,member_no text,payment_year integer,amount numeric)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH matched AS (SELECT * FROM public.members m WHERE m.id=public.shk_resolve_member_link(search_text,search_text)),
 totals AS (SELECT m.member_name,m.member_no,p.payment_year,sum(p.amount) AS amount,
 coalesce(max(p.annual_due),public.shk_safe_fee_due(m.ic_no,'annual',p.payment_year)) AS due
 FROM matched m JOIN public.member_yearly_payments p ON p.member_id=m.id AND p.fee_type='annual'
 GROUP BY m.id,m.member_name,m.member_no,m.ic_no,p.payment_year)
 SELECT true,CASE WHEN t.due IS NULL THEN 'Rekod bayaran; kadar memerlukan IC' WHEN t.amount>=t.due THEN 'Yuran ahli cukup' ELSE 'Bayaran sebahagian' END,t.member_name,t.member_no,t.payment_year,t.amount FROM totals t
 UNION ALL SELECT true,'Ahli dijumpai tetapi belum ada rekod yuran ahli',m.member_name,m.member_no,NULL::integer,NULL::numeric FROM matched m WHERE NOT EXISTS(SELECT 1 FROM totals)
 UNION ALL SELECT false,'Ahli tidak dijumpai',NULL::text,NULL::text,NULL::integer,NULL::numeric WHERE NOT EXISTS(SELECT 1 FROM matched)
 ORDER BY payment_year DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.check_payment_status(search_text text,payment_year_input integer DEFAULT extract(year FROM now())::integer)
RETURNS TABLE(found boolean,status text,member_name text,member_no text,payment_year integer,amount numeric)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH matched AS(SELECT * FROM public.members m WHERE m.id=public.shk_resolve_member_link(search_text,search_text)),
 total AS (SELECT m.member_name,m.member_no,coalesce(sum(p.amount),0) AS amount,
 coalesce(max(p.annual_due),public.shk_safe_fee_due(m.ic_no,'annual',payment_year_input)) AS due
 FROM matched m LEFT JOIN public.member_yearly_payments p ON p.member_id=m.id AND p.fee_type='annual' AND p.payment_year=payment_year_input
 GROUP BY m.id,m.member_name,m.member_no,m.ic_no)
 SELECT true,CASE WHEN t.amount=0 THEN 'Belum ada rekod yuran ahli tahun ini' WHEN t.due IS NULL THEN 'Rekod bayaran; kadar memerlukan IC' WHEN t.amount>=t.due THEN 'Yuran ahli cukup' ELSE 'Bayaran sebahagian' END,
 t.member_name,t.member_no,payment_year_input,t.amount FROM total t
 UNION ALL SELECT false,'Ahli tidak dijumpai',NULL::text,NULL::text,payment_year_input,NULL::numeric WHERE NOT EXISTS(SELECT 1 FROM matched);
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
