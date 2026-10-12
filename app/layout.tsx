import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed } from 'next/font/google';
import './globals.css';

const bigTimeFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-big-time',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aftelklok',
  description: 'Aftelklok voor training en rust op een liggende tablet.',
  applicationName: 'Timer',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Timer',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192x192.png', sizes: '192x192' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#121212',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={bigTimeFont.variable}>
      <body>{children}</body>
    </html>
  );
}
