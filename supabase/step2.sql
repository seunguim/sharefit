-- sharefit 2단계: 글쓰기 저장 · 참여하기 · 참여자에게만 계좌 공개
-- 실행 순서: schema.sql → seed.sql → 이 파일(step2.sql)
-- 이미 앞의 두 파일을 실행했어도 괜찮아요. 이 파일은 여러 번 실행해도 안전해요.
--
-- 바뀌는 점
--  1) 글쓰기·참여는 이제 함수(create_post, join_post)로만 가능해요. 테이블에 직접 쓰는 길은 막아요.
--  2) 참여할 때 받은 '참여 토큰'이 있어야만 정산 계좌를 볼 수 있어요(get_account).
--     토큰은 참여한 브라우저에만 저장되고, 앱 키로는 조회할 수 없어요.
--  3) 글을 쓴 사람(방장)도 첫 번째 참여자로 들어가요.

-- ───────────────────────── 1. 참여 토큰 ─────────────────────────
alter table public.participants
  add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists participants_token_idx on public.participants (token);

-- ───────────────────────── 2. 직접 쓰기 막고, 토큰은 읽기 막기 ─────────────────────────
drop policy if exists "posts 쓰기"        on public.posts;
drop policy if exists "participants 쓰기" on public.participants;
drop policy if exists "accounts 쓰기만"   on public.post_accounts;

revoke insert on public.posts, public.participants, public.post_accounts from anon, authenticated;
revoke select on public.participants from anon, authenticated;
grant  select (id, post_id, nickname, paid, joined_at) on public.participants to anon, authenticated;

-- ───────────────────────── 3. 글쓰기: 글 + 계좌 + 방장 참여를 한 번에 ─────────────────────────
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
  new_id uuid;
  host_token uuid;
begin
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
    (title, category, product_url, total_price, target_count, pickup_place, pickup_at, lat, lng)
  values
    (trim(p_title), p_category, trim(p_product_url), p_total_price, p_target_count,
     trim(p_pickup_place), p_pickup_at, p_lat, p_lng)
  returning id into new_id;

  insert into public.post_accounts (post_id, bank_name, account_number, account_holder)
  values (new_id, trim(p_bank_name), p_account_number, trim(p_account_holder));

  -- 방장도 첫 번째 참여자 (트리거가 인원을 +1 해줘요)
  insert into public.participants (post_id, nickname)
  values (new_id, '방장')
  returning token into host_token;

  return jsonb_build_object('post_id', new_id, 'token', host_token);
end;
$$;

-- ───────────────────────── 4. 참여하기 ─────────────────────────
create or replace function public.join_post(p_post_id uuid, p_nickname text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token uuid;
begin
  -- 인원 +1, 정원이 차면 '모집 완료'로 바꾸는 일은 트리거(handle_new_participant)가 해요.
  insert into public.participants (post_id, nickname)
  values (p_post_id, coalesce(nullif(trim(p_nickname), ''), '참여자'))
  returning token into new_token;

  return new_token;
end;
$$;

-- ───────────────────────── 5. 참여자에게만 계좌 공개 ─────────────────────────
create or replace function public.get_account(p_post_id uuid, p_token uuid)
returns table (bank_name text, account_number text, account_holder text)
language sql
security definer
set search_path = public
stable
as $$
  select a.bank_name, a.account_number, a.account_holder
    from public.post_accounts a
   where a.post_id = p_post_id
     and exists (
       select 1 from public.participants p
        where p.post_id = p_post_id and p.token = p_token
     );
$$;

revoke execute on function public.create_post(text, text, text, integer, integer, text, timestamptz, text, text, text, double precision, double precision) from public;
revoke execute on function public.join_post(uuid, text) from public;
revoke execute on function public.get_account(uuid, uuid) from public;
grant execute on function public.create_post(text, text, text, integer, integer, text, timestamptz, text, text, text, double precision, double precision) to anon, authenticated;
grant execute on function public.join_post(uuid, text) to anon, authenticated;
grant execute on function public.get_account(uuid, uuid) to anon, authenticated;
