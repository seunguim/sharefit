-- sharefit 4단계: 참여 취소
-- 실행 순서: ... → step3.sql → 이 파일(step4.sql)
-- 여러 번 실행해도 안전해요.
--
--  - 내가 참여한 글에서 참여를 취소하면 인원이 -1 되고, '모집 완료'였다면 다시 '모집중'이 돼요.
--  - 글쓴이는 자기 글의 참여를 취소할 수 없어요. (글쓴이가 빠지면 정산받을 사람이 없어지기 때문이에요.)

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

  -- 동시에 참여·취소가 일어나도 인원이 어긋나지 않게 글을 잠가요.
  select * into p from public.posts where id = p_post_id for update;
  if not found then
    raise exception '존재하지 않는 게시글이에요.';
  end if;
  if p.author_id = uid then
    raise exception '글쓴이는 참여를 취소할 수 없어요.';
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

revoke execute on function public.leave_post(uuid) from public, anon, authenticated;
grant  execute on function public.leave_post(uuid) to authenticated;
