import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Impetus | A evolução que não para',
  description: 'Painel de Controlo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body style={{ margin: 0, padding: 0, background: '#121212', color: '#fff', fontFamily: 'sans-serif' }}>
        <div id="root-app">
          {children}
        </div>
      </body>
    </html>
  );
}