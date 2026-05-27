export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

async function fetchSanctionsPage(serviceKey, start, end) {
  const url = `http://openapi.foodsafetykorea.go.kr/api/${serviceKey}/I2630/json/${start}/${end}`;

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data?.I2630 || !Array.isArray(data.I2630.row)) {
      throw new Error("유효한 I2630.row 응답이 없습니다.");
    }

    return data.I2630;
  } catch (error) {
    throw new Error(
      `${start}~${end} 구간 요청에 실패했습니다: ${error.message}`,
    );
  }
}

export async function GET() {
  const serviceKey = process.env.FOODSAFETY_API_KEY;

  if (!serviceKey) {
    return Response.json(
      { error: "FOODSAFETY_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const firstPage = await fetchSanctionsPage(serviceKey, 1, PAGE_SIZE);
    const totalCount = Number(firstPage.total_count) || firstPage.row.length;
    const ranges = [];

    for (let start = PAGE_SIZE + 1; start <= totalCount; start += PAGE_SIZE) {
      ranges.push([start, Math.min(start + PAGE_SIZE - 1, totalCount)]);
    }

    const additionalPages = await Promise.all(
      ranges.map(([start, end]) => fetchSanctionsPage(serviceKey, start, end)),
    );
    const rows = [firstPage, ...additionalPages].flatMap((page) => page.row);

    return Response.json({
      I2630: {
        total_count: totalCount,
        row: rows,
      },
    });
  } catch (error) {
    return Response.json(
      { error: `식의약 데이터 포털 API 수집에 실패했습니다. ${error.message}` },
      { status: 502 },
    );
  }
}
