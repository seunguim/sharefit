-- sharefit 3단계: 로그인(Supabase Auth) 붙이기
-- 실행 순서: schema.sql → seed.sql → step2.sql → 이 파일(step3.sql)
-- 여러 번 실행해도 안전해요.
--
-- 바뀌는 점
--  1) 글쓰기·참여하기는 로그인한 사람만 할 수 있어요. (auth.uid() 사용)
--  2) 참여자는 계정(user_id)으로 구분해요. 한 계정은 한 글에 한 번만 참여할 수 있어요.
--  3) 정산 계좌는 "이 글에 참여한 내 계정"에게만 보여줘요. 참여 토큰은 더 이상 쓰지 않아요.
--  4) 시드(더미) 글 4개에 테스트용 정산 계좌를 넣어요.

-- ───────────────────────── 1. 계정 연결 ─────────────────────────
-- 참여자·글쓴이를 profiles 대신 로그인 계정(auth.users)에 연결해요.
-- (기존 테스트 참여 기록은 user_id가 비어 있어서 그대로 두어도 문제없어요.)
alter table public.participants drop constraint if exists participants_user_id_fkey;
alter table public.participants
  add constraint participants_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.posts drop constraint if exists posts_author_id_fkey;
alter table public.posts
  add constraint posts_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

-- ───────────────────────── 2. 닉네임 ─────────────────────────
-- 회원가입 때 입력한 닉네임을 쓰고, 없으면 이메일 앞부분을 써요.
create or replace function public.current_nickname()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'nickname'), ''),
    nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), ''),
    '참여자'
  );
$$;

-- ───────────────────────── 3. 옛 함수(토큰 방식) 정리 ─────────────────────────
drop function if exists public.join_post(uuid, text);
drop function if exists public.get_account(uuid, uuid);

-- ───────────────────────── 4. 글쓰기 (로그인 필요) ─────────────────────────
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
  p_lng            double precision default null
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
  if length(trim(coalesce(p_pickup_place, ''))) = 0 then
    raise exception '픽업 장소를 입력해주세요.';
  end if;
  if p_account_number !~ '^[0-9]{8,16}$' then
    raise exception '계좌번호는 숫자만 8~16자리로 입력해주세요.';
  end if;
  if length(trim(coalesce(p_bank_name, ''))) = 0 or length(trim(coalesce(p_account_holder, ''))) = 0 then
    raise exception '은행명과 예금주를 입력해주세요.';
  end if;

  insert into public.posts
    (author_id, title, category, product_url, total_price, target_count,
     pickup_place, pickup_at, lat, lng)
  values
    (uid, trim(p_title), p_category, trim(p_product_url), p_total_price, p_target_count,
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

-- ───────────────────────── 5. 참여하기 (로그인 필요, 중복 불가) ─────────────────────────
create or replace function public.join_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  -- 인원 +1, 정원이 차면 '모집 완료'로 바꾸는 일은 트리거(handle_new_participant)가 해요.
  insert into public.participants (post_id, user_id, nickname)
  values (p_post_id, uid, public.current_nickname());
exception
  when unique_violation then
    raise exception '이미 참여한 글이에요.';
end;
$$;

-- ───────────────────────── 6. 내가 참여했는지 / 계좌 보기 / 내가 참여한 글 ─────────────────────────
create or replace function public.has_joined(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.participants p
        where p.post_id = p_post_id and p.user_id = auth.uid()
     );
$$;

create or replace function public.get_account(p_post_id uuid)
returns table (bank_name text, account_number text, account_holder text)
language sql
stable
security definer
set search_path = public
as $$
  select a.bank_name, a.account_number, a.account_holder
    from public.post_accounts a
   where a.post_id = p_post_id
     and public.has_joined(p_post_id);
$$;

create or replace function public.my_participations()
returns table (post_id uuid, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.post_id, p.joined_at
    from public.participants p
   where p.user_id = auth.uid()
   order by p.joined_at desc;
$$;

-- ───────────────────────── 7. 실행 권한 ─────────────────────────
revoke execute on function public.current_nickname() from public, anon, authenticated;

revoke execute on function public.create_post(text, text, text, integer, integer, text, timestamptz, text, text, text, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.join_post(uuid)        from public, anon, authenticated;
revoke execute on function public.my_participations()    from public, anon, authenticated;
revoke execute on function public.has_joined(uuid)       from public, anon, authenticated;
revoke execute on function public.get_account(uuid)      from public, anon, authenticated;

grant execute on function public.create_post(text, text, text, integer, integer, text, timestamptz, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.join_post(uuid)         to authenticated;
grant execute on function public.my_participations()     to authenticated;
grant execute on function public.has_joined(uuid)        to authenticated;
grant execute on function public.get_account(uuid)       to authenticated;

-- ───────────────────────── 8. 시드 글의 테스트 정산 계좌 ─────────────────────────
insert into public.post_accounts (post_id, bank_name, account_number, account_holder)
select id, '토스뱅크', '1000123456789', '테스트'
  from public.posts
 where id in (
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000004'
 )
on conflict (post_id) do nothing;
