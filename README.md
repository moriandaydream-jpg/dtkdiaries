# Supernova Logbook

GitHub Pages에 올릴 수 있는 정적 덕질 일기장입니다. DB와 로그인은 Supabase 기준으로 구성했고, 기본 시대 값은 `Supernova`로 잡았습니다.

## 파일

- `index.html`: 앱 화면
- `styles.css`: 반응형 스타일
- `app.js`: Supabase 연결, 로그인, 일기 저장/수정/삭제
- `supabase-schema.sql`: 테이블, 인덱스, RLS 정책
- `assets/supernova-poster.svg`: 앱 배지 이미지

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
3. Authentication에서 Email 로그인을 켭니다.
4. Project Settings > API에서 Project URL과 `anon public` key를 확인합니다.
5. 배포된 사이트의 `DB 연결`에 URL과 anon key를 저장합니다.

`service_role` key는 브라우저에 넣지 마세요. 이 앱은 공개 가능한 anon key와 RLS 정책을 기준으로 동작합니다.

## GitHub Pages 배포

1. 이 폴더의 파일들을 GitHub 저장소 루트나 `docs/` 폴더에 올립니다.
2. Settings > Pages에서 배포 브랜치와 폴더를 선택합니다.
3. 배포된 주소로 접속해서 Supabase URL과 anon key를 입력합니다.

Supabase 이메일 인증을 켠 상태라면 가입 후 인증 메일을 먼저 확인해야 로그인됩니다.
