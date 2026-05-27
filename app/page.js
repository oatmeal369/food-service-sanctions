"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSanctions() {
      try {
        const response = await fetch("/api/food-service-sanctions", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "데이터를 불러오지 못했습니다.");
        }

        setData(result);
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchSanctions();

    return () => controller.abort();
  }, []);

  const rows = data?.I2630?.row ?? [];
  const totalCount = data?.I2630?.total_count ?? rows.length;

  return (
    <main>
      <h1>식품접객업 행정처분 조회</h1>
      <p className="description">
        브라우저는 서비스 키를 받지 않고 내부 API를 통해서만 데이터를 조회합니다.
      </p>

      <section className="panel">
        {loading && <p className="message">데이터를 불러오는 중입니다.</p>}
        {error && <p className="message error">{error}</p>}
        {!loading && !error && (
          <>
            <p className="count">전체 결과: {totalCount}건</p>
            <div className="records">
              {rows.slice(0, 10).map((row, index) => (
                <pre className="record" key={row.PRDLST_REPORT_NO ?? index}>
                  {JSON.stringify(row, null, 2)}
                </pre>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

