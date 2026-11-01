-- (선택) 테스트 데이터 초기화
-- 테스트하면서 쌓인 참여 기록과 직접 쓴 글을 지우고, 시드 글 4개를 처음 상태로 되돌려요.
-- 시드 글의 정산 계좌(step3.sql에서 넣은 것)는 그대로 둬요.
-- 시드 글의 픽업 시간도 지금부터 며칠 뒤로 다시 맞춰요. (지난 시간으로 남지 않게)
-- 가입한 계정(Authentication → Users)은 지우지 않아요.

delete from public.participants;

delete from public.posts
 where id not in (
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000004'
 );

update public.posts set current_count = 6, status = 'recruiting', pickup_at = now() + interval '3 days' where id = '00000000-0000-0000-0000-000000000001';
update public.posts set current_count = 7, status = 'recruiting', pickup_at = now() + interval '1 day'  where id = '00000000-0000-0000-0000-000000000002';
update public.posts set current_count = 3, status = 'recruiting', pickup_at = now() + interval '5 days' where id = '00000000-0000-0000-0000-000000000003';
update public.posts set current_count = 6, status = 'done',       pickup_at = now() + interval '2 days' where id = '00000000-0000-0000-0000-000000000004';
