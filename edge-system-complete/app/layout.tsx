import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EDGE // Crypto Swing System',
  description: 'Sistema de análisis por confluencias',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700;800&family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
