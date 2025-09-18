
import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { B2ConnectionProvider } from '@/contexts/B2ConnectionContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Multitrack Player',
  description: 'DAW in your browser',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-background overflow-hidden`}>
        <B2ConnectionProvider>
          {children}
        </B2ConnectionProvider>
        <Toaster />
      </body>
    </html>
  );
}
