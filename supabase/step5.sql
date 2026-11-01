-- sharefit 5단계: 송금 완료 표시 (송금 전 / 송금 후 나누기)
-- 실행 순서: ... → step4.sql → 이 파일(step5.sql)
-- 여러 번 실행해도 안전해요.
--
--  - 참여자는 정산 계좌로 송금한 뒤 "송금 완료했어요"를 눌러 표시할 수 있어요. (스스로 표시하는 방식)
--  - 글쓴이는 돈을 받는 사람이라 처음부터 '송금 완료'로 들어가고, 바꿀 수 없어요.
--  - 참여자 현황(닉네임과 송금 여부)은 누구나 볼 수 있어요. 계좌번호와 이메일은 공개되지 않아요.

-- ───────────────────────── 1. 글쓴이는 처음부터 송금 완료 ─────────────────────────
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
  end if;
  return new;
end;
$$;

drop trigger if exists on_participant_mark_author_paid on public.participants;
create trigger on_participant_mark_author_paid
  before insert on public.participants
  for each row execute function public.mark_author_paid();

-- 이미 있는 글쓴이 참여 기록도 맞춰 둬요.
update public.participants p
   set paid = true
  from public.posts po
 where po.id = p.post_id and po.author_id = p.user_id and p.paid = false;

-- ───────────────────────── 2. 송금 완료 표시하기 / 되돌리기 ─────────────────────────
create or replace function public.set_paid(p_post_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  changed integer;
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if exists (select 1 from public.posts where id = p_post_id and author_id = uid) then
    raise exception '글쓴이는 송금을 받는 사람이에요.';
  end if;

  update public.participants
     set paid = coalesce(p_paid, false)
   where post_id = p_post_id and user_id = uid;
  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception '참여하지 않은 글이에요.';
  end if;
end;
$$;

-- 내가 송금 완료로 표시했는지 (참여하지 않았으면 false)
create or replace function public.my_paid(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.paid from public.participants p
      where p.post_id = p_post_id and p.user_id = auth.uid()),
    false
  );
$$;

revoke execute on function public.mark_author_paid() from public, anon, authenticated;
revoke execute on function public.set_paid(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.my_paid(uuid)           from public, anon, authenticated;
grant  execute on function public.set_paid(uuid, boolean) to authenticated;
grant  execute on function public.my_paid(uuid)           to authenticated;
