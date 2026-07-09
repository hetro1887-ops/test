import React from 'react';
import { Inter } from 'next/font/google';
import { TRPCProvider } from '@/trpc/Provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'FinanceFlow — Smart Personal Finance',
  description: 'A premium personal finance dashboard with bank syncing, smart categorization, and beautiful analytics.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <TRPCProvider>
          {children}
        </TRPCProvider>
      </body>
    </html>
  );
}
