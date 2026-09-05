import type { Metadata } from 'next';
import { Inter, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { authClient } from '@/lib/auth/client';
import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({
  subsets: ["latin"],
  display: "block",
  variable: "--font-inter",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-schibsted",
});

export const metadata: Metadata = {
  title: 'Credify | AI Fraud Prevention',
  description: 'AI-Powered Fraud Prevention & Document Verification SDK and SaaS Platform.',
  icons: {
    icon: '/logo.jpeg',
    apple: '/logo.jpeg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${schibsted.variable}`} suppressHydrationWarning>
        <NeonAuthUIProvider
          authClient={authClient}
          redirectTo="/profile-setup"
          emailOTP
          social={{ providers: ['google'] }}
        >
          <Navbar />
          <main className="app-main">
            {children}
          </main>
          <Footer />
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
