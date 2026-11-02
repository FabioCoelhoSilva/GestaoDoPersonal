import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { ImpetusCoach } from '@/components/impetus-coach';
import './globals.css';

export const metadata: Metadata = {
  title: 'Impetus | A evolução que não para',
  description: 'Impetus: A evolução que não para. Gestão inteligente para personal trainers.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT" data-theme="dark">
      <body>
        <AuthProvider>
          {children}
          <ImpetusCoach />
        </AuthProvider>
      </body>
    </html>
  );
}
