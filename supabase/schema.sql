-- sharefit 테이블 만들기 (6차시)
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run
-- 테이블은 유저(profiles) / 게시글(posts) / 참여자(participants) 3개이고,
-- 정산 계좌는 공개되면 안 되는 정보라서 post_accounts로 따로 분리했어요.

-- ───────────────────────── 1. 유저 ─────────────────────────
-- 로그인(Supabase Auth)을 붙이기 전에는 비어 있어도 괜찮아요.
-- 나중에 id를 auth.users의 id와 맞춰서 쓸 예정이에요.
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null,
  location_name text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz not null default now()
);

-- ───────────────────────── 2. 게시글 ─────────────────────────
create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid references public.profiles(id) on delete set null,
  title          text not null,
  category       text not null check (category in ('생필품', '식재료', '배달비')),
  product_url    text not null,
  image_url      text,
  total_price    integer not null check (total_price > 0),
  target_count   integer not null check (target_count >= 2),
  current_count  integer not null default 0,
  -- 1인당 분담금 = 총 금액 ÷ 목표 인원 (나누어떨어지지 않으면 올림). lib/calc.ts와 같은 규칙이에요.
  price_per_person integer generated always as
                   ((ceil(total_price::numeric / target_count))::integer) stored,
  pickup_place   text not null,
  pickup_at      timestamptz not null,
  lat            double precision,
  lng            double precision,
  status         text not null default 'recruiting' check (status in ('recruiting', 'done')),
  created_at     timestamptz not null default now(),
  constraint posts_count_range check (current_count >= 0 and current_count <= target_count)
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_category_idx   on public.posts (category);

-- ───────────────────────── 3. 참여자 ─────────────────────────
create table if not exists public.participants (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  nickname   text,                       -- 로그인 전에는 닉네임만 받아요
  paid       boolean not null default false,   -- 입금 확인 상태
  joined_at  timestamptz not null default now(),
  unique (post_id, user_id)              -- 로그인 후에는 같은 글에 중복 참여할 수 없어요
);

create index if not exists participants_post_idx on public.participants (post_id);

-- ───────────────────────── 4. 정산 계좌 (분리 보관) ─────────────────────────
create table if not exists public.post_accounts (
  post_id         uuid primary key references public.posts(id) on delete cascade,
  bank_name       text not null,
  account_number  text not null,
  account_holder  text not null
);

-- ───────────────────────── 5. 참여하면 인원 +1, 다 차면 '모집 완료' ─────────────────────────
create or replace function public.handle_new_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.posts%rowtype;
begin
  select * into p from public.posts where id = new.post_id for update;  -- 동시에 눌러도 순서대로 처리

  if not found then
    raise exception '존재하지 않는 게시글이에요.';
  end if;
  if p.current_count >= p.target_count then
    raise exception '이미 모집이 완료된 글이에요.';
  end if;

  update public.posts
     set current_count = current_count + 1,
         status = case when current_count + 1 >= target_count then 'done' else 'recruiting' end
   where id = new.post_id;

  return new;
end;
$$;

drop trigger if exists on_participant_insert on public.participants;
create trigger on_participant_insert
  before insert on public.participants
  for each row execute function public.handle_new_participant();

-- ───────────────────────── 6. 접근 규칙(RLS) ─────────────────────────
-- 로그인 기능을 붙이기 전까지는 누구나 글을 읽고, 쓰고, 참여할 수 있게 해뒀어요.
-- 계좌 테이블만은 '쓰기만 가능, 읽기 불가'예요. 앱 키로는 계좌번호를 조회할 수 없어요.
-- (참여 확정자에게만 계좌 공개하는 기능은 로그인 붙일 때 정책을 추가해서 만들어요.)
alter table public.profiles      enable row level security;
alter table public.posts         enable row level security;
alter table public.participants  enable row level security;
alter table public.post_accounts enable row level security;

drop policy if exists "profiles 읽기"      on public.profiles;
drop policy if exists "posts 읽기"         on public.posts;
drop policy if exists "posts 쓰기"         on public.posts;
drop policy if exists "participants 읽기"  on public.participants;
drop policy if exists "participants 쓰기"  on public.participants;
drop policy if exists "accounts 쓰기만"    on public.post_accounts;

create policy "profiles 읽기"     on public.profiles      for select to anon, authenticated using (true);
create policy "posts 읽기"        on public.posts         for select to anon, authenticated using (true);
create policy "posts 쓰기"        on public.posts         for insert to anon, authenticated
  with check (current_count = 0 and status = 'recruiting');   -- 인원 수를 속여서 올리는 것 방지
create policy "participants 읽기" on public.participants  for select to anon, authenticated using (true);
create policy "participants 쓰기" on public.participants  for insert to anon, authenticated with check (true);
create policy "accounts 쓰기만"   on public.post_accounts for insert to anon, authenticated with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.participants to anon, authenticated;
grant insert on public.posts, public.participants, public.post_accounts to anon, authenticated;
