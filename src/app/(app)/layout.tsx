import Link from "next/link";
import { Suspense } from "react";
import { Flash, NavLinks } from "@/components/client";
import { Avatar } from "@/components/ui";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = await getSession();
  const items = [
    { href: "/", label: "Accueil", icon: "🏠" },
    { href: `/listes/${me.id}`, label: "Ma liste", icon: "📝" },
    { href: "/mes-cadeaux", label: "Mes cadeaux", icon: "🎁" },
    ...(me.is_child ? [] : [{ href: "/famille", label: "Famille", icon: "👨‍👩‍👧" }]),
  ];

  return (
    <div className="min-h-dvh pb-24 sm:pb-10">
      <Suspense>
        <Flash />
      </Suspense>
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-7 rounded-lg" />
            Kdo
          </Link>
          <nav className="hidden flex-1 items-center gap-1 sm:flex">
            <NavLinks items={items} />
          </nav>
          <Link href="/compte" className="ml-auto flex items-center gap-2 rounded-full py-1 pl-3 pr-1 text-sm font-bold hover:bg-stone-100 sm:ml-0">
            <span className="max-w-32 truncate">{me.display_name}</span>
            <Avatar member={me} size="sm" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur sm:hidden">
        <NavLinks items={items} />
      </nav>
    </div>
  );
}
