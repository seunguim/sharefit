-- sharefit 6단계: 상품 사진 저장, 글 수정, 지난 픽업 시간 막기
-- 실행 순서: ... → step5.sql → 이 파일(step6.sql)
-- 여러 번 실행해도 안전해요.
--
--  1) 상품 사진은 Supabase Storage의 'post-images' 버킷에 올려요. 로그인한 사람만 자기 폴더에 올릴 수 있고, 사진 주소는 누구나 볼 수 있어요.
--  2) 글쓴이만 자기 글을 수정할 수 있어요. (update_post)
--  3) 픽업 시간이 지금보다 이전이면 글을 쓰거나 바꿀 수 없어요.

-- ───────────────────────── 1. 사진 저장소 (Storage) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 올리기·지우기는 로그인한 사람이 "내 id 이름의 폴더" 안에서만 할 수 있어요.
drop policy if exists "post-images 올리기" on storage.objects;
create policy "post-images 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post-images 지우기" on storage.objects;
create policy "post-images 지우기" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── 2. 글쓰기 (사진 + 지난 시간 막기) ─────────────────────────
drop function if exists public.create_post(text, text, text, integer, integer, text, timestamptz, text, text, text, double precision, double precision);

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
  if p_category is null or p_category not in ('생필품', '식재료', '배달비') then
    raise exception '카테고리를 골라주세요.';
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

  -- 글쓴이도 첫 번째 참여자 (트리거가 인원을 +1 해줘요)
  insert into public.participants (post_id, user_id, nickname)
  values (new_id, uid, public.current_nickname());

  return jsonb_build_object('post_id', new_id);
end;
$$;

-- ───────────────────────── 3. 글 수정 (글쓴이만) ─────────────────────────
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

  -- 동시에 참여가 들어와도 인원이 어긋나지 않게 글을 잠가요.
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
  if p_category is null or p_category not in ('생필품', '식재료', '배달비') then
    raise exception '카테고리를 골라주세요.';
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
  -- 시간을 바꿀 때만 "지금보다 이후"인지 확인해요. (시간을 그대로 두면 다른 내용은 고칠 수 있어요.)
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

  -- 이미 송금한 참여자가 있으면 금액·인원은 바꿀 수 없어요. (낸 돈과 어긋나지 않게)
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

-- ───────────────────────── 4. 실행 권한 ─────────────────────────
revoke execute on function public.create_post(text, text, text, integer, integer, text, timestamptz, text, text, text, double precision, double precision, text) from public, anon, authenticated;
revoke execute on function public.update_post(uuid, text, text, text, integer, integer, text, timestamptz, text, text, text, text, boolean) from public, anon, authenticated;
grant  execute on function public.create_post(text, text, text, integer, integer, text, timestamptz, text, text, text, double precision, double precision, text) to authenticated;
grant  execute on function public.update_post(uuid, text, text, text, integer, integer, text, timestamptz, text, text, text, text, boolean) to authenticated;
