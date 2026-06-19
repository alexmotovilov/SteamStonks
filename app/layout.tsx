import type { Metadata } from 'next'
import { Cinzel, IM_Fell_English } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ParallaxBackground } from '@/components/parallax-background'
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
      <body className="font-body antialiased pb-10">
        <ParallaxBackground />
        {children}
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "48px",
          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.97))",
          zIndex: 49,
          pointerEvents: "none",
        }} />
        <img
          src="/header-chain.png"
          alt=""
          aria-hidden="true"
          style={{
            position: "fixed",
            bottom: -37,
            left: 0,
            width: "100%",
            height: "auto",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
