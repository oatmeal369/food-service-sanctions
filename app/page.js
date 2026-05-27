"use client";

import { useEffect, useMemo, useState } from "react";

const INITIAL_VISIBLE_ROWS = 150;
const LOAD_MORE_ROWS = 100;
const EMPTY_FILTERS = {
  businessName: "",
  region: "",
  industry: "",
  disposition: "",
  violation: "",
};

const VIOLATION_RULES = [
  ["청소년 주류제공", /(청소년|미성년).*(주류|술)|(주류|술).*(청소년|미성년)/],
  ["유흥접객행위", /(유흥접객|접객행위|유흥종사자|도우미)/],
  ["이물혼입", /(이물|혼입)/],
  ["소비기한 경과", /(소비기한|유통기한).*(경과|초과|지난)|(경과|초과).*(소비기한|유통기한)/],
  ["시설기준 위반", /(시설기준|시설 기준|시설물)/],
  ["영업장 외 영업", /(영업장\s*외|영업장.*밖|옥외\s*영업|장소.*변경)/],
  ["보관온도 위반", /(보관온도|냉장|냉동|온도).*(위반|미준수|부적합)|(위반|미준수).*(보관온도|냉장|냉동|온도)/],
];

const CHECKLIST_ITEMS = [
  "청소년 주류제공 방지를 위한 신분증 확인",
  "소비기한 경과 제품 보관 및 사용 금지",
  "냉장·냉동 식품의 보관온도 기록과 준수",
  "영업장 면적 또는 장소 변경 시 사전 신고",
  "이물혼입 방지를 위한 방충·방서 및 조리장 관리",
  "종업원 위생교육과 영업자 준수사항 정기 확인",
];

function getValue(value) {
  const text = String(value ?? "").trim();
  return text && text !== "-" ? text : "";
}

function displayValue(value) {
  return getValue(value) || "-";
}

function normalize(value) {
  return getValue(value).toLocaleLowerCase();
}

function truncate(value, length = 80) {
  const text = displayValue(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function formatDate(value) {
  const text = getValue(value);

  if (!text) {
    return "-";
  }

  const compactDate = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactDate) {
    return `${compactDate[1]}.${compactDate[2]}.${compactDate[3]}`;
  }

  const separatedDate = text.match(/^(\d{4})[/-](\d{2})[/-](\d{2})(.*)$/);
  if (separatedDate) {
    return `${separatedDate[1]}.${separatedDate[2]}.${separatedDate[3]}${separatedDate[4]}`;
  }

  return text;
}

function dateSortValue(row) {
  const rawDate = getValue(row.DSPS_DCSNDT) || getValue(row.LAST_UPDT_DTM);
  const digits = rawDate.replace(/\D/g, "").slice(0, 8);
  return digits.length === 8 ? Number(digits) : 0;
}

function classifyViolation(row) {
  const target = `${getValue(row.VILTCN)} ${getValue(row.LAWORD_CD_NM)}`;
  const match = VIOLATION_RULES.find(([, rule]) => rule.test(target));
  return match?.[0] ?? "기타";
}

function getRegion(row) {
  const addressRegion = getValue(row.ADDR).split(" ")[0];
  if (addressRegion) {
    return addressRegion;
  }

  return getValue(row.DSPS_INSTTCD_NM) || "미상";
}

function countBy(rows, selector, limit = 5) {
  const counts = new Map();

  rows.forEach((row) => {
    const label = selector(row) || "미상";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ko"))
    .slice(0, limit);
}

function createOptions(rows, key) {
  return [...new Set(rows.map((row) => getValue(row[key])).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "ko"),
  );
}

function SummaryCard({ title, value, note }) {
  return (
    <article className="summary-card">
      <p className="summary-label">{title}</p>
      <strong className="summary-value">{value}</strong>
      <p className="summary-note">{note}</p>
    </article>
  );
}

function BarChart({ title, items }) {
  const largestCount = items[0]?.count ?? 1;

  return (
    <article className="chart-card">
      <h3>{title}</h3>
      {items.length === 0 && <p className="empty-chart">집계할 결과가 없습니다.</p>}
      <div className="bars">
        {items.map((item) => (
          <div className="bar-row" key={item.label}>
            <div className="bar-label">
              <span title={item.label}>{item.label}</span>
              <strong>{item.count.toLocaleString()}건</strong>
            </div>
            <div className="bar-track">
              <span style={{ width: `${(item.count / largestCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function DetailField({ label, value, wide = false }) {
  return (
    <div className={`detail-field${wide ? " detail-wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{displayValue(value)}</dd>
    </div>
  );
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ROWS);
  const [selectedRow, setSelectedRow] = useState(null);
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

        const resultRows = Array.isArray(result?.I2630?.row) ? result.I2630.row : [];
        const resultCount = Number(result?.I2630?.total_count);

        setRows(resultRows);
        setTotalCount(Number.isFinite(resultCount) ? resultCount : resultRows.length);
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

  useEffect(() => {
    if (!selectedRow) {
      return undefined;
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setSelectedRow(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedRow]);

  const analyzedRows = useMemo(
    () =>
      [...rows]
        .sort((left, right) => dateSortValue(right) - dateSortValue(left))
        .map((row) => ({ ...row, violationCategory: classifyViolation(row) })),
    [rows],
  );

  const industryOptions = useMemo(() => createOptions(analyzedRows, "INDUTY_CD_NM"), [analyzedRows]);
  const dispositionOptions = useMemo(
    () => createOptions(analyzedRows, "DSPS_TYPECD_NM"),
    [analyzedRows],
  );

  const filteredRows = useMemo(() => {
    const businessName = normalize(filters.businessName);
    const region = normalize(filters.region);
    const violation = normalize(filters.violation);

    return analyzedRows.filter(
      (row) =>
        (!businessName || normalize(row.PRCSCITYPOINT_BSSHNM).includes(businessName)) &&
        (!region ||
          `${normalize(row.DSPS_INSTTCD_NM)} ${normalize(row.ADDR)}`.includes(region)) &&
        (!filters.industry || getValue(row.INDUTY_CD_NM) === filters.industry) &&
        (!filters.disposition || getValue(row.DSPS_TYPECD_NM) === filters.disposition) &&
        (!violation || normalize(row.VILTCN).includes(violation)),
    );
  }, [analyzedRows, filters]);

  const overviewDisposition = useMemo(
    () => countBy(analyzedRows, (row) => getValue(row.DSPS_TYPECD_NM), 1)[0]?.label ?? "-",
    [analyzedRows],
  );
  const overviewViolation = useMemo(
    () => countBy(analyzedRows, (row) => row.violationCategory, 1)[0]?.label ?? "-",
    [analyzedRows],
  );

  const dispositionStats = useMemo(
    () => countBy(filteredRows, (row) => getValue(row.DSPS_TYPECD_NM)),
    [filteredRows],
  );
  const industryStats = useMemo(
    () => countBy(filteredRows, (row) => getValue(row.INDUTY_CD_NM)),
    [filteredRows],
  );
  const regionStats = useMemo(() => countBy(filteredRows, getRegion), [filteredRows]);
  const violationStats = useMemo(
    () => countBy(filteredRows, (row) => row.violationCategory, 8),
    [filteredRows],
  );

  const visibleRows = filteredRows.slice(0, visibleCount);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    setVisibleCount(INITIAL_VISIBLE_ROWS);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setVisibleCount(INITIAL_VISIBLE_ROWS);
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#home">
            식품접객업 행정처분 분석
          </a>
          <nav aria-label="주요 메뉴">
            <a href="#home">홈</a>
            <a href="#search">처분 사례 검색</a>
            <a href="#analysis">위반유형 분석</a>
            <a href="#statistics">지역·업종 통계</a>
            <a href="#checklist">예방 체크리스트</a>
          </nav>
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <p className="eyebrow">PUBLIC FOOD SAFETY DATA DASHBOARD</p>
          <h1>식품접객업 행정처분 분석</h1>
          <p className="hero-description">
            식품안전나라 공공데이터를 기반으로 음식점·휴게음식점·주점 등의 행정처분 사례를
            검색하고 분석합니다.
          </p>
        </section>

        {loading && (
          <section className="status-panel" aria-live="polite">
            <span className="loader" />
            <p>행정처분 데이터를 불러오고 있습니다.</p>
          </section>
        )}

        {error && (
          <section className="status-panel error-panel" role="alert">
            <strong>데이터를 표시할 수 없습니다.</strong>
            <p>{error}</p>
          </section>
        )}

        {!loading && !error && (
          <>
            <section className="summary-grid" aria-label="홈 요약">
              <SummaryCard
                title="전체 사례 수"
                value={`${totalCount.toLocaleString()}건`}
                note={`현재 ${analyzedRows.length.toLocaleString()}건을 분석 중입니다.`}
              />
              <SummaryCard
                title="최신 처분일"
                value={formatDate(analyzedRows[0]?.DSPS_DCSNDT)}
                note="처분확정일자 기준"
              />
              <SummaryCard
                title="주요 처분유형"
                value={overviewDisposition}
                note="현재 수신 데이터 최다 유형"
              />
              <SummaryCard
                title="주요 위반 키워드"
                value={overviewViolation}
                note="위반내용·법령 기반 자동 분류"
              />
            </section>

            <section className="panel filter-panel" id="search">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">CASE SEARCH</p>
                  <h2>처분 사례 검색</h2>
                </div>
                <p className="result-number">{filteredRows.length.toLocaleString()}건 검색됨</p>
              </div>

              <form className="filter-grid" onSubmit={(event) => event.preventDefault()}>
                <label>
                  <span>업소명 검색</span>
                  <input
                    name="businessName"
                    onChange={updateFilter}
                    placeholder="업소명을 입력하세요"
                    type="search"
                    value={filters.businessName}
                  />
                </label>
                <label>
                  <span>지역 검색</span>
                  <input
                    name="region"
                    onChange={updateFilter}
                    placeholder="처분기관 또는 주소"
                    type="search"
                    value={filters.region}
                  />
                </label>
                <label>
                  <span>업종 선택</span>
                  <select name="industry" onChange={updateFilter} value={filters.industry}>
                    <option value="">전체 업종</option>
                    {industryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>처분유형 선택</span>
                  <select
                    name="disposition"
                    onChange={updateFilter}
                    value={filters.disposition}
                  >
                    <option value="">전체 처분유형</option>
                    {dispositionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="violation-filter">
                  <span>위반내용 검색</span>
                  <input
                    name="violation"
                    onChange={updateFilter}
                    placeholder="예: 청소년, 소비기한, 이물"
                    type="search"
                    value={filters.violation}
                  />
                </label>
                <button className="reset-button" onClick={resetFilters} type="button">
                  필터 초기화
                </button>
              </form>
            </section>

            <section className="panel table-panel">
              <div className="section-heading table-heading">
                <div>
                  <p className="section-kicker">SANCTION CASES</p>
                  <h2>행정처분 사례 목록</h2>
                </div>
                <p className="section-note">최근 처분확정일 순으로 표시합니다.</p>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>업소명</th>
                      <th>업종</th>
                      <th>처분기관/지역</th>
                      <th>위반내용 요약</th>
                      <th>처분유형</th>
                      <th>처분기간</th>
                      <th>법령근거</th>
                      <th>공개일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => (
                      <tr
                        aria-label={`${displayValue(row.PRCSCITYPOINT_BSSHNM)} 상세 보기`}
                        key={row.DSPSDTLS_SEQ || `${row.LCNS_NO}-${row.DSPS_DCSNDT}-${index}`}
                        onClick={() => setSelectedRow(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedRow(row);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <td className="business-name">{displayValue(row.PRCSCITYPOINT_BSSHNM)}</td>
                        <td>{displayValue(row.INDUTY_CD_NM)}</td>
                        <td>
                          {displayValue(row.DSPS_INSTTCD_NM)}
                          <small>{truncate(row.ADDR, 26)}</small>
                        </td>
                        <td className="violation-cell">
                          <span className="category-badge">{row.violationCategory}</span>
                          {truncate(row.VILTCN)}
                        </td>
                        <td>
                          <span className="disposition-badge">
                            {displayValue(row.DSPS_TYPECD_NM)}
                          </span>
                        </td>
                        <td>
                          {formatDate(row.DSPS_BGNDT)} ~ {formatDate(row.DSPS_ENDDT)}
                        </td>
                        <td>{truncate(row.LAWORD_CD_NM, 44)}</td>
                        <td>{formatDate(row.PUBLIC_DT)}</td>
                      </tr>
                    ))}
                    {visibleRows.length === 0 && (
                      <tr>
                        <td className="no-results" colSpan="8">
                          검색 조건에 맞는 사례가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredRows.length > visibleRows.length && (
                <button
                  className="more-button"
                  onClick={() => setVisibleCount((count) => count + LOAD_MORE_ROWS)}
                  type="button"
                >
                  더 보기 ({visibleRows.length.toLocaleString()} / {filteredRows.length.toLocaleString()}건)
                </button>
              )}
            </section>

            <section className="analysis-section" id="analysis">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">ANALYSIS</p>
                  <h2>위반유형 및 통계</h2>
                </div>
                <p className="section-note">현재 검색 결과 기준 집계</p>
              </div>
              <div className="chart-grid" id="statistics">
                <BarChart items={dispositionStats} title="처분유형별 건수" />
                <BarChart items={industryStats} title="업종별 건수" />
                <BarChart items={regionStats} title="지역별 건수" />
                <BarChart items={violationStats} title="위반유형별 건수" />
              </div>
            </section>

            <section className="checklist-section" id="checklist">
              <div>
                <p className="section-kicker">PREVENTION GUIDE</p>
                <h2>음식점 운영자 예방 체크리스트</h2>
                <p className="checklist-description">
                  반복되는 행정처분 위험을 줄이기 위해 운영 중 정기적으로 확인하세요.
                </p>
              </div>
              <ul className="checklist">
                {CHECKLIST_ITEMS.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      {selectedRow && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRow(null);
            }
          }}
        >
          <section aria-labelledby="modal-title" aria-modal="true" className="modal" role="dialog">
            <div className="modal-header">
              <div>
                <p className="section-kicker">CASE DETAIL</p>
                <h2 id="modal-title">{displayValue(selectedRow.PRCSCITYPOINT_BSSHNM)}</h2>
              </div>
              <button
                aria-label="상세 보기 닫기"
                autoFocus
                className="modal-close"
                onClick={() => setSelectedRow(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <p className="modal-category">{selectedRow.violationCategory}</p>
            <dl className="detail-grid">
              <DetailField label="업소명" value={selectedRow.PRCSCITYPOINT_BSSHNM} />
              <DetailField label="업종" value={selectedRow.INDUTY_CD_NM} />
              <DetailField label="주소" value={selectedRow.ADDR} wide />
              <DetailField label="위반내용 원문" value={selectedRow.VILTCN} wide />
              <DetailField label="법령근거" value={selectedRow.LAWORD_CD_NM} wide />
              <DetailField label="처분내용" value={selectedRow.DSPSCN} wide />
              <DetailField label="처분시작일" value={formatDate(selectedRow.DSPS_BGNDT)} />
              <DetailField label="처분종료일" value={formatDate(selectedRow.DSPS_ENDDT)} />
              <DetailField label="공개일" value={formatDate(selectedRow.PUBLIC_DT)} />
              <DetailField label="마지막 업데이트 일시" value={formatDate(selectedRow.LAST_UPDT_DTM)} />
            </dl>
          </section>
        </div>
      )}
    </>
  );
}
