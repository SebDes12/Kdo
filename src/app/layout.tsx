import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Nunito } from "next/font/google";
import { Snowfall } from "@/components/theme";
import { DEFAULT_THEME, THEME_COOKIE, isTheme, themeColor } from "@/lib/themes";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Kdo", template: "%s · Kdo" },
  description: "Les idées cadeaux de la famille, sans gâcher la surprise.",
  appleWebApp: { capable: true, title: "Kdo", statusBarStyle: "default" },
};

/** Thème enregistré dans le cookie (posé par l'application après le choix de la personne). */
async function readTheme() {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : DEFAULT_THEME;
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: themeColor(await readTheme()), width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await readTheme();
  return (
    <html lang="fr" data-theme={theme} className={`${nunito.variable} antialiased`}>
      <body className="font-sans">
        {children}
        <Snowfall current={theme} />
      </body>
    </html>
  );
}
