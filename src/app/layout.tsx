import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'M-Keter Message Center',
  description: 'HubSpot 연락처 기반 SMS/카카오 알림톡 통합 발송 플랫폼 | powered by SparkNova',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
