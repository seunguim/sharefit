-- sharefit 7단계: 친구들 피드백 반영
-- 실행 순서: ... → step6.sql → 이 파일(step7.sql)
-- 여러 번 실행해도 안전해요.
--
--  1) 글쓴이의 입금 확인: 송금 전 → 입금 확인 대기(참여자가 송금 완료 표시) → 입금 확인 완료(글쓴이가 확인)
--  2) 공동구매할 수 없는 물품(주류·담배·의약품·총기류·마약류 등)은 글을 올릴 수 없어요.
--  3) 카테고리를 8가지로 늘려요.
--  4) 글쓴이가 입금을 확인한 참여자는 참여를 취소할 수 없어요.

-- ───────────────────────── 1. 입금 확인 ─────────────────────────
alter table public.participants
  add column if not exists confirmed boolean not null default false;

-- 글쓴이는 돈을 받는 사람이라 송금 완료 + 입금 확인 완료로 시작해요.
create or replace function public.mark_author_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null
     and exists (select 1 from public.posts where id = new.post_id and author_id = new.user_id) then
    new.paid := true;
    new.confirmed := true;
  end if;
  return new;
end;
$$;

update public.participants p
   set paid = true, confirmed = true
  from public.posts po
 where po.id = p.post_id and po.author_id = p.user_id and not (p.paid and p.confirmed);

-- 참여자 현황 (닉네임, 단계). 계정 정보는 내보내지 않고, 글쓴이인지 여부만 알려줘요.
create or replace function public.get_participants(p_post_id uuid)
returns table (id uuid, nickname text, paid boolean, confirmed boolean, is_author boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         coalesce(p.nickname, '참여자'),
         p.paid,
         p.confirmed,
         (p.user_id is not null and p.user_id = po.author_id)
    from public.participants p
    join public.posts po on po.id = p.post_id
   where p.post_id = p_post_id
   order by p.joined_at;
$$;

-- 내 송금 단계: 'none'(참여 안 함) / 'before'(송금 전) / 'pending'(입금 확인 대기) / 'confirmed'(입금 확인 완료)
create or replace function public.my_payment_status(p_post_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when p.confirmed then 'confirmed'
                 when p.paid then 'pending'
                 else 'before' end
       from public.participants p
      where p.post_id = p_post_id and p.user_id = auth.uid()),
    'none'
  );
$$;

-- 송금 완료 표시하기 / 되돌리기. 글쓴이가 이미 확인했으면 되돌릴 수 없어요.
create or replace function public.set_paid(p_post_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me  public.participants%rowtype;
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if exists (select 1 from public.posts where id = p_post_id and author_id = uid) then
    raise exception '글쓴이는 송금을 받는 사람이에요.';
  end if;

  select * into me from public.participants
   where post_id = p_post_id and user_id = uid;
  if not found then
    raise exception '참여하지 않은 글이에요.';
  end if;
  if me.confirmed and not coalesce(p_paid, false) then
    raise exception '글쓴이가 이미 입금을 확인해서 되돌릴 수 없어요.';
  end if;

  update public.participants
     set paid = coalesce(p_paid, false)
   where id = me.id;
end;
$$;

-- 글쓴이가 입금을 확인하기 / 확인 취소하기
create or replace function public.confirm_payment(p_participant_id uuid, p_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t   public.participants%rowtype;
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  select * into t from public.participants where id = p_participant_id;
  if not found then
    raise exception '참여자를 찾을 수 없어요.';
  end if;
  if not exists (select 1 from public.posts where id = t.post_id and author_id = uid) then
    raise exception '글쓴이만 입금을 확인할 수 있어요.';
  end if;
  if t.user_id = uid then
    raise exception '글쓴이 본인은 확인할 필요가 없어요.';
  end if;
  if coalesce(p_confirmed, false) and not t.paid then
    raise exception '아직 송금 완료를 표시하지 않은 참여자예요.';
  end if;

  update public.participants
     set confirmed = coalesce(p_confirmed, false)
   where id = p_participant_id;
end;
$$;

-- ───────────────────────── 2. 공동구매 불가 물품 ─────────────────────────
-- 화면(lib/banned.ts)의 목록과 같은 단어예요. 단어를 바꾸면 두 곳을 같이 고쳐주세요.
create or replace function public.contains_banned_item(p_text text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
      from unnest(array[
        '주류', '소주', '맥주', '와인', '위스키', '막걸리', '보드카', '양주',
        '담배', '전자담배', '니코틴',
        '의약품', '전문의약품', '처방약',
        '마약', '대마',
        '총기', '도검', '실탄'
      ]) as k
     where position(lower(k) in lower(coalesce(p_text, ''))) > 0
  );
$$;

-- ───────────────────────── 3. 카테고리 8가지 ─────────────────────────
alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts
  add constraint posts_category_check
  check (category in ('생필품', '식재료', '배달비', '의류', '가구', '전자제품', '일회용품', '기타'));

create or replace function public.is_valid_category(p_category text)
returns boolean
language sql
immutable
as $$
  select p_category in ('생필품', '식재료', '배달비', '의류', '가구', '전자제품', '일회용품', '기타');
$$;

-- ───────────────────────── 4. 글쓰기 / 글 수정에 새 검사 넣기 ─────────────────────────
create or replace function public.create_post(
  p_title          text,
  p_category       text,
  p_product_url    text,
  p_total_price    integer,
  p_target_count   integer,
  p_pickup_place   text,
  p_pickup_at      timestamptz,
  p_bank_name      text,
  p_account_number text,
  p_account_holder text,
  p_lat            double precision default null,
  p_lng            double precision default null,
  p_image_url      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception '제목을 입력해주세요.';
  end if;
  if not public.is_valid_category(p_category) then
    raise exception '카테고리를 골라주세요.';
  end if;
  if public.contains_banned_item(p_title) or public.contains_banned_item(p_product_url) then
    raise exception '공동구매할 수 없는 물품이에요. (주류, 담배, 의약품, 총기류, 마약류 등)';
  end if;
  if p_total_price is null or p_total_price <= 0 then
    raise exception '총 결제 금액은 1원 이상이어야 해요.';
  end if;
  if p_target_count is null or p_target_count < 2 then
    raise exception '공구 인원은 2명 이상이어야 해요.';
  end if;
  if length(trim(coalesce(p_pickup_place, ''))) = 0 then
    raise exception '픽업 장소를 입력해주세요.';
  end if;
  if p_pickup_at is null or p_pickup_at <= now() then
    raise exception '픽업 시간은 지금보다 이후여야 해요.';
  end if;
  if p_account_number !~ '^[0-9]{8,16}$' then
    raise exception '계좌번호는 숫자만 8~16자리로 입력해주세요.';
  end if;
  if length(trim(coalesce(p_bank_name, ''))) = 0 or length(trim(coalesce(p_account_holder, ''))) = 0 then
    raise exception '은행명과 예금주를 입력해주세요.';
  end if;
  if p_image_url is not null and p_image_url !~ '^https://[^/]+/storage/v1/object/public/post-images/' then
    raise exception '올바르지 않은 사진 주소예요.';
  end if;

  insert into public.posts
    (author_id, title, category, product_url, image_url, total_price, target_count,
     pickup_place, pickup_at, lat, lng)
  values
    (uid, trim(p_title), p_category, trim(p_product_url), p_image_url, p_total_price, p_target_count,
     trim(p_pickup_place), p_pickup_at, p_lat, p_lng)
  returning id into new_id;

  insert into public.post_accounts (post_id, bank_name, account_number, account_holder)
  values (new_id, trim(p_bank_name), p_account_number, trim(p_account_holder));

  -- 글쓴이도 첫 번째 참여자 (트리거가 인원을 +1 하고, 송금·입금 확인 완료로 표시해줘요)
  insert into public.participants (post_id, user_id, nickname)
  values (new_id, uid, public.current_nickname());

  return jsonb_build_object('post_id', new_id);
end;
$$;

create or replace function public.update_post(
  p_post_id        uuid,
  p_title          text,
  p_category       text,
  p_product_url    text,
  p_total_price    integer,
  p_target_count   integer,
  p_pickup_place   text,
  p_pickup_at      timestamptz,
  p_bank_name      text,
  p_account_number text,
  p_account_holder text,
  p_image_url      text default null,
  p_clear_image    boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p   public.posts%rowtype;
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  select * into p from public.posts where id = p_post_id for update;
  if not found then
    raise exception '존재하지 않는 게시글이에요.';
  end if;
  if p.author_id is distinct from uid then
    raise exception '내가 쓴 글만 수정할 수 있어요.';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception '제목을 입력해주세요.';
  end if;
  if not public.is_valid_category(p_category) then
    raise exception '카테고리를 골라주세요.';
  end if;
  if public.contains_banned_item(p_title) or public.contains_banned_item(p_product_url) then
    raise exception '공동구매할 수 없는 물품이에요. (주류, 담배, 의약품, 총기류, 마약류 등)';
  end if;
  if p_total_price is null or p_total_price <= 0 then
    raise exception '총 결제 금액은 1원 이상이어야 해요.';
  end if;
  if p_target_count is null or p_target_count < 2 then
    raise exception '공구 인원은 2명 이상이어야 해요.';
  end if;
  if p_target_count < p.current_count then
    raise exception '이미 %명이 참여해서 공구 인원을 그보다 적게 줄일 수 없어요.', p.current_count;
  end if;
  if length(trim(coalesce(p_pickup_place, ''))) = 0 then
    raise exception '픽업 장소를 입력해주세요.';
  end if;
  if p_pickup_at is null then
    raise exception '픽업 날짜와 시간을 선택해주세요.';
  end if;
  if p_pickup_at is distinct from p.pickup_at and p_pickup_at <= now() then
    raise exception '픽업 시간은 지금보다 이후여야 해요.';
  end if;
  if p_account_number !~ '^[0-9]{8,16}$' then
    raise exception '계좌번호는 숫자만 8~16자리로 입력해주세요.';
  end if;
  if length(trim(coalesce(p_bank_name, ''))) = 0 or length(trim(coalesce(p_account_holder, ''))) = 0 then
    raise exception '은행명과 예금주를 입력해주세요.';
  end if;
  if p_image_url is not null and p_image_url !~ '^https://[^/]+/storage/v1/object/public/post-images/' then
    raise exception '올바르지 않은 사진 주소예요.';
  end if;

  if (p_total_price <> p.total_price or p_target_count <> p.target_count)
     and exists (
       select 1 from public.participants
        where post_id = p_post_id and paid and user_id is distinct from p.author_id
     ) then
    raise exception '이미 송금한 참여자가 있어서 금액과 인원은 바꿀 수 없어요.';
  end if;

  update public.posts
     set title        = trim(p_title),
         category     = p_category,
         product_url  = trim(p_product_url),
         total_price  = p_total_price,
         target_count = p_target_count,
         pickup_place = trim(p_pickup_place),
         pickup_at    = p_pickup_at,
         image_url    = case when p_clear_image then null
                             when p_image_url is not null then p_image_url
                             else image_url end,
         status       = case when current_count >= p_target_count then 'done' else 'recruiting' end
   where id = p_post_id;

  insert into public.post_accounts (post_id, bank_name, account_number, account_holder)
  values (p_post_id, trim(p_bank_name), p_account_number, trim(p_account_holder))
  on conflict (post_id) do update
    set bank_name      = excluded.bank_name,
        account_number = excluded.account_number,
        account_holder = excluded.account_holder;
end;
$$;

-- ───────────────────────── 4-2. 참여 취소: 입금이 확인된 뒤에는 불가 ─────────────────────────
create or replace function public.leave_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p   public.posts%rowtype;
  removed integer;
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  select * into p from public.posts where id = p_post_id for update;
  if not found then
    raise exception '존재하지 않는 게시글이에요.';
  end if;
  if p.author_id = uid then
    raise exception '글쓴이는 참여를 취소할 수 없어요.';
  end if;
  if exists (
    select 1 from public.participants
     where post_id = p_post_id and user_id = uid and confirmed
  ) then
    raise exception '글쓴이가 입금을 확인한 뒤에는 참여를 취소할 수 없어요.';
  end if;

  delete from public.participants
   where post_id = p_post_id and user_id = uid;
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception '참여하지 않은 글이에요.';
  end if;

  update public.posts
     set current_count = greatest(current_count - 1, 0),
         status = 'recruiting'
   where id = p_post_id;
end;
$$;

-- ───────────────────────── 5. 실행 권한 ─────────────────────────
revoke execute on function public.contains_banned_item(text) from public, anon, authenticated;
revoke execute on function public.is_valid_category(text)    from public, anon, authenticated;
revoke execute on function public.get_participants(uuid)         from public, anon, authenticated;
revoke execute on function public.my_payment_status(uuid)        from public, anon, authenticated;
revoke execute on function public.confirm_payment(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.set_paid(uuid, boolean)        from public, anon, authenticated;
revoke execute on function public.leave_post(uuid)               from public, anon, authenticated;

grant execute on function public.get_participants(uuid)         to anon, authenticated;
grant execute on function public.my_payment_status(uuid)        to authenticated;
grant execute on function public.confirm_payment(uuid, boolean) to authenticated;
grant execute on function public.set_paid(uuid, boolean)        to authenticated;
grant execute on function public.leave_post(uuid)               to authenticated;
