# DREAMTAKU DIARIES

GitHub Pages에 올릴 수 있는 정적 덕질 일기장입니다. 화면은 GitHub Pages가 서빙하고, 백엔드는 Supabase Auth + Supabase Postgres입니다. 기본 시대 값은 `Supernova`로 잡았습니다.

## 파일

- `index.html`: 앱 화면
- `styles.css`: 반응형 스타일
- `app.js`: Supabase 연결, 로그인, 일기 저장/수정/삭제, 음악 메타데이터 검색, 이미지/YouTube 표시, 감상 카드 PNG 내보내기
- `supabase-schema.sql`: 테이블, 인덱스, RLS 정책
- `supabase-music-migration.sql`: 기존 DB에 음악 메타데이터 컬럼 추가
- `supabase-storage-setup.sql`: 이미지 업로드용 private Storage 버킷과 정책
- `assets/supernova-poster.svg`: 앱 배지 이미지

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
3. 사진 업로드를 쓸 경우 SQL Editor에서 `supabase-storage-setup.sql` 내용을 실행합니다.
4. Authentication > Providers에서 Email 로그인을 켭니다.
5. Project Settings > API에서 Project URL과 `anon public` key를 확인합니다.
6. 배포된 사이트의 `DB 연결`에 URL과 anon key를 저장합니다.

`service_role` key는 브라우저에 넣지 마세요. 이 앱은 공개 가능한 anon key와 RLS 정책을 기준으로 동작합니다.

이미 `fandom_diary_entries` 테이블을 만든 상태에서 음악 메타데이터 기능만 추가한다면 SQL Editor에서 `supabase-music-migration.sql`을 한 번 실행하세요.

## 음악 메타데이터

작성 폼의 `디깅 검색`은 MusicBrainz에서 곡 메타데이터를 검색해서 `곡 제목`, `가수`, `음반 제목`, `발매일`을 채웁니다. 음원 파일이나 미리듣기는 저장하지 않고 텍스트 메타데이터와 링크만 저장합니다. 검색이 안 되면 같은 필드에 직접 입력해도 됩니다.

## 무드 태그

무드는 여러 개를 칩처럼 선택할 수 있습니다. 기존 `mood` 텍스트 컬럼에 쉼표로 묶어 저장하므로 별도 DB 마이그레이션 없이 기존 Supabase 테이블에서 그대로 동작합니다.

별점은 선택 사항입니다. 비워두면 `없음`으로 저장되고 카드와 공유 이미지에는 별점이 표시되지 않습니다.

사이트 안의 제목, 음악 정보, 본문은 말줄임표로 줄이지 않고 줄바꿈으로 표시합니다.

## 미디어 URL

일기 작성 폼의 `이미지 / YouTube URL`에는 이미지 파일 URL이나 YouTube 링크를 넣을 수 있습니다. 지원하는 YouTube 형식은 `youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`, `youtube.com/embed/...`입니다.

## 이미지 업로드

`이미지 업로드`에서 파일을 고르고 업로드하면 Supabase Storage의 `diary-media` 버킷에 저장됩니다. DB에는 실제 이미지 파일이 아니라 `supabase://diary-media/...` 경로만 저장되고, 화면에서는 로그인한 사용자에게 signed URL로 이미지를 보여줍니다.

버킷은 private으로 만들고 정책은 `사용자ID/파일명` 경로만 허용합니다. 사진 용량은 파일당 8MB까지이며, GIF를 제외한 이미지는 브라우저에서 긴 변 1600px JPEG로 줄여 업로드합니다.

## 이미지로 공유

각 카드의 `이미지로 공유` 버튼은 브라우저에서 PNG 감상 카드를 만듭니다. 사이트 카드에서는 YouTube를 iframe으로 보여주고, 공유 PNG를 만들 때만 YouTube 썸네일을 이미지처럼 넣습니다. 업로드한 이미지는 사이트 카드와 공유 카드 모두에서 자르지 않고 전체가 보이도록 표시합니다. 긴 감상문은 공유 PNG 높이가 내용 길이에 맞춰 늘어납니다.

지원되는 브라우저에서는 공유 패널을 열고, 그렇지 않으면 PNG 파일을 다운로드합니다. 생성된 이미지는 Supabase에 업로드하지 않으므로 DB 저장량이 늘지 않습니다. 외부 이미지 URL은 해당 사이트의 CORS 설정에 따라 공유 카드에 직접 들어가지 못할 수 있습니다.

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
