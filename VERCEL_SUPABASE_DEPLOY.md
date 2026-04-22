# 무료 배포 방법

가장 쉬운 무료 조합:

- 배포: Vercel Hobby
- 데이터 저장: Supabase Free

## 1. Supabase 프로젝트 만들기

1. Supabase 가입
2. 새 프로젝트 생성
3. SQL Editor 열기
4. `supabase-setup.sql` 내용 실행

## 2. Supabase 정보 복사

Supabase Dashboard 에서 아래 2개를 복사합니다.

- Project URL
- anon public key

## 3. `config.js` 수정

```js
window.APP_CONFIG = {
  backend: "supabase",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY",
  supabaseTable: "app_state",
  supabaseRowId: "main"
};
```

## 4. Vercel 배포

1. GitHub에 이 폴더 업로드
2. Vercel 가입
3. GitHub 저장소 Import
4. Deploy 클릭

## 5. 접속

배포가 끝나면 Vercel 주소가 생깁니다.

예:

```text
https://your-project.vercel.app
```

이 주소를 스마트폰 데이터로 열면 됩니다.

## 중요한 점

- 이 방식은 서버 없이 정적 배포 + Supabase DB를 직접 사용하는 방식입니다.
- 현재 관리자 로그인은 프론트에 있는 간단한 로그인이라 보안이 아주 강한 구조는 아닙니다.
- 실제 회사 운영용으로 더 안전하게 하려면 다음 단계에서 사용자 권한과 서버 인증을 따로 붙이는 것이 좋습니다.
