export const dynamic = "force-dynamic";

export async function GET() {
  const serviceKey = process.env.FOODSAFETY_API_KEY;

  if (!serviceKey) {
    return Response.json(
      { error: "FOODSAFETY_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const url = `http://openapi.foodsafetykorea.go.kr/api/${serviceKey}/I2630/json/1/1000`;

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return Response.json(
        { error: "식의약 데이터 포털 API 요청에 실패했습니다." },
        { status: response.status },
      );
    }

    const data = await response.json();

    return Response.json(data);
  } catch {
    return Response.json(
      { error: "식의약 데이터 포털 API에 연결할 수 없습니다." },
      { status: 502 },
    );
  }
}

