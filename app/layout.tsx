import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CRM", template: "%s — CRM" },
  description: "CRM-система: заявки, клиенты, задачи и аналитика",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
