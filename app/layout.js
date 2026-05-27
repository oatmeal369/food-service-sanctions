import "./globals.css";

export const metadata = {
  title: "식품접객업 행정처분 조회",
  description: "서버 API 라우트를 통한 식품접객업 행정처분 조회",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

