# Food Service Sanctions

식의약 데이터 포털 API 키를 브라우저에 노출하지 않고 Next.js 서버 라우트에서만 사용하는 예제입니다.

## 환경 변수

`.env.local.example`을 참고해 로컬 환경 변수 파일 `.env.local`을 만들고 실제 키는 그 파일에만 설정합니다.

```env
FOODSAFETY_API_KEY=your_actual_service_key
```

`.env.local`은 Git에서 제외됩니다.

## 실행

```bash
npm install
npm run dev
```

페이지는 `/api/food-service-sanctions`만 호출하며, 해당 서버 라우트가 식의약 데이터 포털 요청을 수행합니다.
