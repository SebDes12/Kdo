"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} {...rest}>
      {pending ? (pendingText ?? "…") : children}
    </button>
  );
}

/**
 * Bouton qui demande confirmation dans une fenêtre Kdo avant d'envoyer
 * le formulaire qui le contient.
 */
export function ConfirmButton({
  children,
  message,
  title,
  confirmLabel = "Confirmer",
  cancelLabel = "Revenir",
  danger = true,
  icon,
  className = "btn-danger",
}: {
  children: React.ReactNode;
  /** Texte d'explication (ou la question si aucun titre n'est donné). */
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Action destructrice (bouton rouge) ou simple confirmation. */
  danger?: boolean;
  /** Pictogramme de la fenêtre (🗑 par défaut pour une suppression). */
  icon?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <ConfirmDialog
      triggerLabel={children}
      triggerClassName={className}
      disabled={pending}
      title={title ?? message}
      message={title ? message : undefined}
      confirm={
        <button type="submit" data-confirm className={danger ? "btn bg-red-600 text-white hover:bg-red-700" : "btn-primary"}>
          {confirmLabel}
        </button>
      }
      cancelLabel={cancelLabel}
      danger={danger}
      icon={icon}
    />
  );
}

/** Fenêtre de confirmation (élément <dialog> natif, accessible au clavier). */
function ConfirmDialog({
  triggerLabel,
  triggerClassName,
  disabled,
  title,
  message,
  confirm,
  cancelLabel,
  danger,
  icon,
}: {
  triggerLabel: React.ReactNode;
  triggerClassName: string;
  disabled?: boolean;
  title: string;
  message?: string;
  confirm: React.ReactNode;
  cancelLabel: string;
  danger: boolean;
  icon?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();
  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close();
  };
  return (
    <>
      <button type="button" disabled={disabled} className={triggerClassName} onClick={open}>
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        onClick={onBackdrop}
        className="m-auto w-[min(92vw,24rem)] rounded-3xl border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-band/60 backdrop:backdrop-blur-sm open:animate-[kdo-pop_.15s_ease-out]"
      >
        <div className="p-6 text-center">
          <div className={`mx-auto mb-3 flex size-14 items-center justify-center rounded-full text-2xl ${danger ? "bg-red-100" : "bg-brand-50"}`}>
            {icon ?? (danger ? "🗑" : "🎁")}
          </div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          {message && <p className="mt-2 text-sm text-muted">{message}</p>}
          <div className="mt-6 grid grid-cols-2 gap-2" onClick={(e) => (e.target as HTMLElement).closest("[data-confirm]") && close()}>
            <button type="button" className="btn-secondary" onClick={close} autoFocus>
              {cancelLabel}
            </button>
            {confirm}
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Message de succès / d'erreur passé dans l'URL (?ok=… / ?erreur=…). */
export function Flash() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const error = params.get("erreur");
  const ok = params.get("ok");
  const key = `${error ?? ""}|${ok ?? ""}`;
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const hidden = hiddenKey === key;
  const setHidden = () => setHiddenKey(key);

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => {
      setHiddenKey(key);
      const next = new URLSearchParams(params);
      next.delete("ok");
      const qs = next.toString();
      router.replace(pathname + (qs ? `?${qs}` : "") + window.location.hash, { scroll: false });
    }, 3500);
    return () => clearTimeout(t);
  }, [ok, key, params, pathname, router]);

  if (hidden || (!error && !ok)) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div
        role={error ? "alert" : "status"}
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-lg ${
          error ? "bg-red-600 text-white" : "bg-ink text-white"
        }`}
      >
        <span>{error ? "⚠️" : "✓"}</span>
        <span className="flex-1">{error ?? ok}</span>
        <button type="button" onClick={setHidden} className="opacity-70 hover:opacity-100" aria-label="Fermer">
          ✕
        </button>
      </div>
    </div>
  );
}

export function NavLinks({
  items,
  onBand = false,
}: {
  items: { href: string; label: string; icon: string }[];
  /** Liens posés sur le bandeau de couleur (en-tête ordinateur). */
  onBand?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/evenements") : pathname.startsWith(href));
  return (
    <>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-bold transition sm:flex-none sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${
            onBand
              ? isActive(it.href)
                ? "bg-white/15 text-band-ink"
                : "text-band-ink/80 hover:bg-white/10 hover:text-band-ink"
              : isActive(it.href)
                ? "text-brand-600"
                : "text-muted hover:text-ink"
          }`}
        >
          <span className="text-xl sm:text-base" aria-hidden>
            {it.icon}
          </span>
          {it.label}
        </Link>
      ))}
    </>
  );
}

/** Éditeur de liens d'achat (un champ par lien). */
export function LinksEditor({ initial }: { initial: string[] }) {
  const [links, setLinks] = useState(initial.length ? initial : [""]);
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input
            name="links"
            type="text" autoCapitalize="none" autoCorrect="off"
            inputMode="url"
            className="field"
            placeholder="https://…"
            value={l}
            onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {links.length > 1 && (
            <button
              type="button"
              className="btn-ghost"
              aria-label="Retirer ce lien"
              onClick={() => setLinks(links.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost -ml-3" onClick={() => setLinks([...links, ""])}>
        + Ajouter un autre lien
      </button>
    </div>
  );
}

/** Copie (ou partage sur mobile) un lien d'invitation. */
export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="field min-w-0 font-mono text-xs" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          if (typeof navigator.share === "function" && /Mobi/i.test(navigator.userAgent)) {
            try {
              await navigator.share({ title: "Rejoins la famille sur Kdo", url });
              return;
            } catch {
              /* annulé : on copie */
            }
          }
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copié ✓" : "Partager"}
      </button>
    </div>
  );
}

type ResetState = { link?: string; error?: string };

/** Bouton « Mot de passe » : génère un lien de réinitialisation pour un autre adulte. */
export function ResetLinkButton({
  name,
  action,
}: {
  name: string;
  action: (prev: ResetState) => Promise<ResetState>;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <div className="w-full">
      {!state.link && (
        <form action={run}>
          <ConfirmDialog
            triggerLabel="🔑 Mot de passe"
            triggerClassName="btn-ghost py-1 text-xs"
            disabled={pending}
            title={`Nouveau mot de passe pour ${name} ?`}
            message={`Tu vas obtenir un lien à lui envoyer (valable 2 jours). Son mot de passe actuel restera valable jusqu'à ce qu'il en choisisse un nouveau.`}
            confirm={
              <button type="submit" data-confirm className="btn-primary">
                Créer le lien
              </button>
            }
            cancelLabel="Revenir"
            danger={false}
          />
        </form>
      )}
      {state.error && <p className="mt-1 text-xs font-bold text-red-700">{state.error}</p>}
      {state.link && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted">Envoie ce lien à {name} (valable 2 jours, une seule fois) :</p>
          <ShareLink url={state.link} />
        </div>
      )}
    </div>
  );
}
