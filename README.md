# Supernova Logbook

GitHub Pages에 올릴 수 있는 정적 덕질 일기장입니다. 화면은 GitHub Pages가 서빙하고, 백엔드는 Supabase Auth + Supabase Postgres입니다. 기본 시대 값은 `Supernova`로 잡았습니다.

## 파일

- `index.html`: 앱 화면
- `styles.css`: 반응형 스타일
- `app.js`: Supabase 연결, 로그인, 일기 저장/수정/삭제, 이미지/YouTube 표시, 감상 카드 PNG 내보내기
- `supabase-schema.sql`: 테이블, 인덱스, RLS 정책
- `assets/supernova-poster.svg`: 앱 배지 이미지

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
3. Authentication > Providers에서 Email 로그인을 켭니다.
4. Project Settings > API에서 Project URL과 `anon public` key를 확인합니다.
5. 배포된 사이트의 `DB 연결`에 URL과 anon key를 저장합니다.

`service_role` key는 브라우저에 넣지 마세요. 이 앱은 공개 가능한 anon key와 RLS 정책을 기준으로 동작합니다.

## 미디어 URL

일기 작성 폼의 `이미지 / YouTube URL`에는 이미지 파일 URL이나 YouTube 링크를 넣을 수 있습니다. 지원하는 YouTube 형식은 `youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`, `youtube.com/embed/...`입니다.

## 이미지로 공유

각 카드의 `이미지로 공유` 버튼은 브라우저에서 PNG 감상 카드를 만듭니다. 지원되는 브라우저에서는 공유 패널을 열고, 그렇지 않으면 PNG 파일을 다운로드합니다. 생성된 이미지는 Supabase에 업로드하지 않으므로 DB 저장량이 늘지 않습니다.

## 인증이 안 될 때

- 백엔드는 Supabase입니다. GitHub Pages에는 서버 코드가 없습니다.
- Supabase의 Authentication > Providers에서 Email provider가 켜져 있어야 합니다.
- 빠른 테스트만 할 때는 Authentication > Sign In / Providers 쪽의 email confirmation을 잠시 끄면 바로 로그인됩니다.
- 이메일 인증을 켜둘 때는 Authentication > URL Configuration에 GitHub Pages 배포 주소를 Site URL과 Redirect URLs로 등록하세요.
- 예: `https://사용자명.github.io/저장소명/`
- 로그인 에러가 `Email not confirmed`이면 인증 메일을 먼저 눌러야 합니다.
- 로그인 에러가 `Invalid login credentials`이면 가입이 안 됐거나, 인증 전이거나, 비밀번호가 틀린 상태입니다.

## GitHub Pages 배포

1. 이 폴더의 파일들을 GitHub 저장소 루트나 `docs/` 폴더에 올립니다.
2. Settings > Pages에서 배포 브랜치와 폴더를 선택합니다.
3. 배포된 주소로 접속해서 Supabase URL과 anon key를 입력합니다.

Supabase 이메일 인증을 켠 상태라면 가입 후 인증 메일을 먼저 확인해야 로그인됩니다.
