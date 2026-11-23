import Link from "next/link";
import type { Member } from "@/lib/types";

const COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

function colorFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({ member, size = "md" }: { member?: Pick<Member, "id" | "display_name">; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "size-7 text-xs" : size === "lg" ? "size-12 text-lg" : "size-9 text-sm";
  if (!member) return <span className={`${dims} inline-flex shrink-0 rounded-full bg-stone-200`} />;
  return (
    <span
      title={member.display_name}
      className={`${dims} ${colorFor(member.id)} inline-flex shrink-0 items-center justify-center rounded-full font-extrabold ring-2 ring-white`}
    >
      {member.display_name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Section({
  title,
  id,
  children,
  action,
  description,
}: {
  title: React.ReactNode;
  id?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ icon = "🎁", children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-8 text-center text-muted">
      <div className="mb-2 text-3xl">{icon}</div>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "stone" }: { children: React.ReactNode; tone?: "stone" | "brand" | "green" | "amber" | "violet" }) {
  const tones = {
    stone: "bg-stone-100 text-stone-700",
    brand: "bg-brand-100 text-brand-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    violet: "bg-violet-100 text-violet-800",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 to-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mx-auto mb-3 size-14 rounded-2xl shadow-lg shadow-brand-200" />
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok" | "info"; children: React.ReactNode }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  };
  return <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${tones[tone]}`}>{children}</div>;
}
