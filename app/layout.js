import "./globals.css";

export const metadata = {
  title: "식품접객업 행정처분 분석",
  description: "식품안전나라 공공데이터 기반 식품접객업 행정처분 분석 대시보드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
