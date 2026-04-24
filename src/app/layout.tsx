import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Exemplo, se você usar a fonte Inter
import "./globals.css";

// Mudei apenas a parte da fonte para garantir que não dê erro,
// mas o foco é este bloco de Metadata:
export const metadata: Metadata = {
  title: "Inscrição Fé Reformada | Inscrições",
  description: "Garanta sua vaga para o evento da Fé Reformada. Pré-reserva rápida, fácil e segura.",
  openGraph: {
    title: "Inscrição Fé Reformada | Inscrições",
    description: "Garanta sua vaga para o evento da Fé Reformada.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  );
}