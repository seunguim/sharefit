-- sharefit 8단계: 댓글 · 공지
-- 실행 순서: ... → step7.sql → 이 파일(step8.sql)
-- 여러 번 실행해도 안전해요.
--
--  - 글마다 댓글을 남길 수 있어요. 참여자와 글쓴이만 쓸 수 있고, 누구나 읽을 수 있어요.
--  - 글쓴이가 쓴 댓글은 '공지'로 올릴 수 있어요. 공지는 목록 맨 위에 고정돼요.
--  - 댓글은 쓴 사람이, 그리고 글쓴이가 지울 수 있어요.

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  nickname   text not null,
  body       text not null check (char_length(body) between 1 and 300),
  is_notice  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx
  on public.post_comments (post_id, created_at);

-- 표를 직접 읽고 쓰는 길은 막고, 아래 함수로만 다뤄요.
alter table public.post_comments enable row level security;
revoke all on public.post_comments from anon, authenticated;

-- 댓글 목록: 공지가 먼저, 그다음 오래된 순서
create or replace function public.get_comments(p_post_id uuid)
returns table (
  id         uuid,
  nickname   text,
  body       text,
  is_notice  boolean,
  created_at timestamptz,
  is_author  boolean,
  is_mine    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.nickname,
         c.body,
         c.is_notice,
         c.created_at,
         (c.author_id is not null and c.author_id = p.author_id) as is_author,
         (c.author_id is not null and c.author_id = auth.uid())  as is_mine
    from public.post_comments c
    join public.posts p on p.id = c.post_id
   where c.post_id = p_post_id
   order by c.is_notice desc, c.created_at asc;
$$;

-- 댓글 쓰기: 참여자 또는 글쓴이만, 공지는 글쓴이만
create or replace function public.add_comment(
  p_post_id   uuid,
  p_body      text,
  p_is_notice boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  p    public.posts%rowtype;
  text_body text := trim(coalesce(p_body, ''));
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  select * into p from public.posts where id = p_post_id;
  if not found then
    raise exception '존재하지 않는 게시글이에요.';
  end if;
  if char_length(text_body) = 0 then
    raise exception '내용을 입력해 주세요.';
  end if;
  if char_length(text_body) > 300 then
    raise exception '댓글은 300자까지 쓸 수 있어요.';
  end if;
  if p.author_id is distinct from uid
     and not exists (select 1 from public.participants
                      where post_id = p_post_id and user_id = uid) then
    raise exception '이 글에 참여한 사람만 댓글을 쓸 수 있어요.';
  end if;
  if coalesce(p_is_notice, false) and p.author_id is distinct from uid then
    raise exception '공지는 글쓴이만 올릴 수 있어요.';
  end if;

  insert into public.post_comments (post_id, author_id, nickname, body, is_notice)
  values (p_post_id, uid, public.current_nickname(), text_body, coalesce(p_is_notice, false));
end;
$$;

-- 댓글 지우기: 쓴 사람 또는 글쓴이
create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c   public.post_comments%rowtype;
  post_author uuid;
begin
  if uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  select * into c from public.post_comments where id = p_comment_id;
  if not found then
    raise exception '이미 지워진 댓글이에요.';
  end if;
  select author_id into post_author from public.posts where id = c.post_id;
  if c.author_id is distinct from uid and post_author is distinct from uid then
    raise exception '내 댓글이나 내가 쓴 글의 댓글만 지울 수 있어요.';
  end if;
  delete from public.post_comments where id = p_comment_id;
end;
$$;

revoke execute on function public.get_comments(uuid)                 from public, anon, authenticated;
revoke execute on function public.add_comment(uuid, text, boolean)   from public, anon, authenticated;
revoke execute on function public.delete_comment(uuid)               from public, anon, authenticated;

grant execute on function public.get_comments(uuid)                  to anon, authenticated;
grant execute on function public.add_comment(uuid, text, boolean)    to authenticated;
grant execute on function public.delete_comment(uuid)                to authenticated;
