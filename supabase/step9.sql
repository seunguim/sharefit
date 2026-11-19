-- sharefit 9단계: 모집 마감일 · 내 글 삭제
-- 실행 순서: ... → step8.sql → 이 파일(step9.sql)
-- 여러 번 실행해도 안전해요.
--
--  - 글마다 모집 마감일(deadline)을 정할 수 있어요. 비워 두면 마감일 없이 정원이 찰 때까지 모집해요.
--  - 마감일이 지나면 새로 참여할 수 없어요. (이미 참여한 사람은 그대로예요.)
--  - 글쓴이는 다른 참여자가 없을 때만 자기 글을 삭제할 수 있어요.

-- ───────────────────────── 1. 마감일 칸 ─────────────────────────
alter table public.posts add column if not exists deadline timestamptz;

-- ───────────────────────── 2. 마감일 정하기·바꾸기 (글쓴이만) ─────────────────────────
-- p_deadline이 null이면 마감일을 없애요.
create or replace function public.set_deadline(p_post_id uuid, p_deadline timestamptz)
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
    raise exception '글쓴이만 마감일을 바꿀 수 있어요.';
  end if;
  if p_deadline is not null then
    if p_deadline <= now() then
      raise exception '마감일은 지금보다 이후로 정해주세요.';
    end if;
    if p_deadline > p.pickup_at then
      raise exception '마감일은 픽업 시간보다 늦을 수 없어요.';
    end if;
  end if;
  update public.posts set deadline = p_deadline where id = p_post_id;
end;
$$;

-- ───────────────────────── 3. 참여하기: 마감일이 지나면 막기 ─────────────────────────
create or replace function public.join_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  dl  timestamptz;
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  select deadline into dl from public.posts where id = p_post_id;
  if dl is not null and dl <= now() then
    raise exception '모집 기간이 끝난 글이에요.';
  end if;

  -- 인원 +1, 정원이 차면 '모집 완료'로 바꾸는 일은 트리거(handle_new_participant)가 해요.
  insert into public.participants (post_id, user_id, nickname)
  values (p_post_id, uid, public.current_nickname());
exception
  when unique_violation then
    raise exception '이미 참여한 글이에요.';
end;
$$;

-- ───────────────────────── 4. 내 글 삭제 (글쓴이만, 다른 참여자가 없을 때만) ─────────────────────────
-- 돌려주는 값은 올려 둔 사진 주소예요. 앱이 이 주소로 사진 파일도 함께 지워요.
create or replace function public.delete_post(p_post_id uuid)
returns text
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
    raise exception '이미 지워졌거나 없는 글이에요.';
  end if;
  if p.author_id is distinct from uid then
    raise exception '글쓴이만 글을 삭제할 수 있어요.';
  end if;
  if exists (select 1 from public.participants
              where post_id = p_post_id and user_id is distinct from uid) then
    raise exception '다른 참여자가 있어서 삭제할 수 없어요. 참여자가 모두 취소한 뒤에 삭제해 주세요.';
  end if;

  -- 참여 기록, 정산 계좌, 댓글은 글과 함께 지워져요.
  delete from public.posts where id = p_post_id;
  return p.image_url;
end;
$$;

revoke execute on function public.set_deadline(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.join_post(uuid)                 from public, anon, authenticated;
revoke execute on function public.delete_post(uuid)               from public, anon, authenticated;

grant execute on function public.set_deadline(uuid, timestamptz)  to authenticated;
grant execute on function public.join_post(uuid)                  to authenticated;
grant execute on function public.delete_post(uuid)                to authenticated;
