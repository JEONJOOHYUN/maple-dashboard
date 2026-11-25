-- 관리자 표(site_admins)에 서버가 줄을 넣고 뺄 수 있게 합니다.
-- 왜: 014 에서는 읽기만 줬습니다(관리자는 SQL 로 넣음). 관리자 화면의 "관리자 추가"가 생겨, 주인(owner)이
--     화면에서 다른 회원을 편집(editor)으로 넣고 뺄 수 있어야 합니다.
-- 누가 쓰나: 서버(app/admin/actions.ts → lib/auth/admin.ts)만, 로그인한 회원이 주인일 때. 넣는 줄은 항상 editor 이고
--           빼는 것도 editor 줄만입니다(주인 줄은 화면에서 못 바꿈 — 주인을 바꾸려면 SQL).
-- 고치기(UPDATE)는 주지 않습니다: 역할을 화면에서 올릴 길이 없습니다.
-- 여러 번 실행해도 안전합니다.

grant insert, delete on public.site_admins to service_role;
