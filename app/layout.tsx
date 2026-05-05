import type { Metadata } from 'next'
import { Cinzel, IM_Fell_English } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

// Display font — headings, item names, card titles, nav
const cinzel = Cinzel({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

// Body font — descriptions, small labels, body copy
const imFellEnglish = IM_Fell_English({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Prognos - Predict Game Success',
  description: 'Compete against other players by predicting the success of upcoming PC game releases. Earn mana through accurate predictions and win prizes!',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png',  media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${imFellEnglish.variable}`}>
      <body className="font-body antialiased">
        <div
          style={{
            position: "fixed", inset: 0, zIndex: -1,
            backgroundImage: "url('/background.png')",
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          style={{
            position: "fixed", inset: 0, zIndex: -1,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
