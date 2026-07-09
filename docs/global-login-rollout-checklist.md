# 전역 로그인 전환 체크리스트

이 문서는 전역 로그인 적용 상태와 긴급 롤백 방법을 확인하기 위한 운영 체크리스트입니다. 2026년 7월 10일 현재 `requireGlobalLogin: true`로 적용되었습니다.

## 1. Supabase Auth 설정 확인

- Authentication 설정에서 일반 회원가입을 허용합니다.
- 이메일 인증을 사용합니다.
- Site URL 또는 Redirect URL에 `https://jhint.vercel.app/`을 등록합니다.
- 새 계정은 이메일 인증 후에도 권한이 없으면 접속되지 않습니다. 관리자가 계정관리에서 권한을 지정해야 합니다.

## 2. Vercel 환경변수 확인

- `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_SECRET_KEY`가 Production 환경에 있어야 합니다.
- 이 키는 서버 API에서만 사용하고 브라우저 코드에는 절대 넣지 않습니다.

## 3. 운영 스위치

현재 `config.js`에는 아래 값이 적용되어 있습니다.

```js
requireGlobalLogin: true
```

끄거나 긴급 롤백할 때는 다시 아래처럼 바꿉니다.

```js
requireGlobalLogin: false
```

## 4. 배포 후 확인 순서

1. 로그아웃 상태에서 사이트 접속 시 로그인 화면이 먼저 나오는지 확인합니다.
2. 계정생성에서 이름, 전화번호, 이메일, 비밀번호를 입력해 인증 메일이 가는지 확인합니다.
3. 인증 메일을 누른 뒤 바로 접속되지 않고 관리자 승인 안내가 나오는지 확인합니다.
4. 관리자 계정으로 로그인해 계정관리에서 새 계정에 권한을 지정합니다.
5. 새 계정으로 로그인해 권한별 메뉴가 맞게 보이는지 확인합니다.
6. 관리자 외 계정은 계정관리에 접근할 수 없는지 확인합니다.

## 5. 문제 발생 시 확인

- 회원가입에서 “초대받은 이메일만 가입 가능” 안내가 나오면 Supabase 일반 회원가입 허용 설정을 확인합니다.
- 계정 목록이 안 나오면 Vercel 환경변수의 `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_SECRET_KEY`를 확인합니다.
- 인증 메일 링크가 다른 주소로 열리면 `authRedirectUrl: "https://jhint.vercel.app/"` 설정을 확인합니다.
