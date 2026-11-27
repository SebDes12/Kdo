import Link from "next/link";
import { Suspense } from "react";
import { Flash, NavLinks } from "@/components/client";
import { ThemeMenu, ThemeSync } from "@/components/theme";
import { GuidedTour } from "@/components/tour";
import { Avatar } from "@/components/ui";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = await getSession();
  const items = [
    { href: "/", label: "Accueil", icon: "🏠", tour: "accueil" },
    { href: "/j-offre", label: "J'offre", icon: "🛍️", tour: "j-offre" },
    { href: `/listes/${me.id}`, label: "Ma liste", icon: "📝", tour: "ma-liste" },
    ...(me.is_child ? [] : [{ href: "/famille", label: "Famille", icon: "👨‍👩‍👧", tour: "famille" }]),
  ];

  return (
    <div className="pb-24 sm:pb-10">
      <ThemeSync theme={me.theme} restore={me.theme_restore} />
      <GuidedTour autoStart={!me.tour_done} isChild={me.is_child} name={me.display_name} />
      <Suspense>
        <Flash />
      </Suspense>
      <header className="band sticky top-0 z-30 border-b-[3px] border-accent shadow-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-7 rounded-lg" />
            Kdo
          </Link>
          <nav className="hidden flex-1 items-center gap-1 sm:flex">
            <NavLinks items={items} onBand />
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <ThemeMenu current={me.theme ?? "or"} />
            <Link href="/compte" className="flex items-center gap-2 rounded-full py-1 pl-3 pr-1 text-sm font-bold hover:bg-white/10">
              <span className="max-w-32 truncate">{me.display_name}</span>
              <Avatar member={me} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6">{children}</main>

      <nav className="band fixed inset-x-0 bottom-0 z-30 flex border-t-[3px] border-accent px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_8px_rgba(0,0,0,0.12)] sm:hidden">
        <NavLinks items={items} />
      </nav>
    </div>
  );
}
