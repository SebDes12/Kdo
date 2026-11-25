import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Kdo", template: "%s · Kdo" },
  description: "Les idées cadeaux de la famille, sans gâcher la surprise.",
  appleWebApp: { capable: true, title: "Kdo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#173f2f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${nunito.variable} antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
