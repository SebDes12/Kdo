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

type LinkState = { link?: string; error?: string };

/**
 * Bouton qui génère (après confirmation) un lien à usage unique à envoyer
 * à quelqu'un : réinitialisation de mot de passe, connexion d'un enfant…
 */
export function LinkButton({
  label,
  title,
  message,
  confirmLabel,
  shareText,
  action,
  className = "btn-ghost py-1 text-xs",
}: {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  /** Texte affiché au-dessus du lien obtenu. */
  shareText: string;
  action: (prev: LinkState) => Promise<LinkState>;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <div className="w-full">
      {!state.link && (
        <form action={run}>
          <ConfirmDialog
            triggerLabel={label}
            triggerClassName={className}
            disabled={pending}
            title={title}
            message={message}
            confirm={
              <button type="submit" data-confirm className="btn-primary">
                {confirmLabel}
              </button>
            }
            cancelLabel="Revenir"
            danger={false}
            icon="🔗"
          />
        </form>
      )}
      {state.error && <p className="mt-1 text-xs font-bold text-red-700">{state.error}</p>}
      {state.link && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted">{shareText}</p>
          <ShareLink url={state.link} />
        </div>
      )}
    </div>
  );
}

/** Réduit une image dans le navigateur (canvas) : côté le plus long ≤ max px. */
async function shrinkImage(source: ImageBitmap | HTMLImageElement, max: number, type: string, quality: number): Promise<Blob | null> {
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff"; // fond blanc pour les images transparentes (JPEG)
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    try {
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(img.src);
    }
  }
}

const PHOTO_MAX_BYTES = 580_000;

/** Grande version (1280 px) + vignette (256 px), en WebP si possible, sinon JPEG. */
async function preparePhoto(file: File): Promise<{ big: File; thumb: File }> {
  const source = await decodeImage(file);
  let type = "image/webp";
  let big = await shrinkImage(source, 1280, type, 0.82);
  if (!big || big.type !== type) {
    type = "image/jpeg"; // navigateur sans encodeur WebP
    big = await shrinkImage(source, 1280, type, 0.82);
  }
  for (const [max, q] of [[1280, 0.7], [1024, 0.7], [800, 0.65]] as const) {
    if (!big || big.size <= PHOTO_MAX_BYTES) break;
    big = await shrinkImage(source, max, type, q);
  }
  const thumb = await shrinkImage(source, 256, type, 0.75);
  if ("close" in source) source.close();
  if (!big || !thumb || big.size > PHOTO_MAX_BYTES) throw new Error("photo");
  const ext = type === "image/webp" ? "webp" : "jpg";
  return { big: new File([big], `photo.${ext}`, { type }), thumb: new File([thumb], `vignette.${ext}`, { type }) };
}

/**
 * Photo d'une idée : choisie (galerie / appareil photo / fichier), glissée
 * ou collée, puis réduite dans le navigateur avant l'envoi. Ou une adresse web.
 */
export function PhotoPicker({ photoSrc, imageUrl }: { photoSrc: string | null; imageUrl: string | null }) {
  const bigRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(imageUrl ?? "");
  const [over, setOver] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const setFiles = (big: File | null, thumb: File | null) => {
    for (const [ref, f] of [[bigRef, big], [thumbRef, thumb]] as const) {
      if (!ref.current) continue;
      const dt = new DataTransfer();
      if (f) dt.items.add(f);
      ref.current.files = dt.files;
    }
  };

  const handle = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "") {
      setError("Ce fichier n'est pas une image");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { big, thumb } = await preparePhoto(file);
      setFiles(big, thumb);
      setPreview(URL.createObjectURL(big));
      setRemoved(false);
      setUrl("");
    } catch {
      setError("Impossible de lire cette image (essaie en JPEG ou PNG)");
    } finally {
      setBusy(false);
    }
  };

  // Coller une image (Ctrl+V) depuis un site ou une capture d'écran
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        void handle(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const remove = () => {
    setFiles(null, null);
    setPreview(null);
    setRemoved(true);
    if (pickRef.current) pickRef.current.value = "";
  };

  const shown = preview ?? (!removed ? photoSrc : null) ?? (url.trim() && /^https?:\/\//i.test(url.trim()) ? url.trim() : null);
  const hasPhoto = !!preview || (!!photoSrc && !removed);

  return (
    <div className="space-y-2">
      <input ref={bigRef} type="file" name="photo" hidden tabIndex={-1} />
      <input ref={thumbRef} type="file" name="photoThumb" hidden tabIndex={-1} />
      <input type="hidden" name="removePhoto" value={removed ? "1" : ""} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={`flex items-center gap-3 rounded-xl border border-dashed p-3 ${over ? "border-brand-500 bg-brand-50" : "border-line"}`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Aperçu" className="size-20 shrink-0 rounded-xl border border-line object-cover" />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-2xl" aria-hidden>
            📷
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <label className="btn-secondary cursor-pointer py-2">
            {busy ? "Préparation…" : hasPhoto ? "Changer la photo" : "Ajouter une photo"}
            <input
              ref={pickRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => void handle(e.target.files?.[0])}
            />
          </label>
          {hasPhoto && (
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={remove}>
              Retirer la photo
            </button>
          )}
          <p className="hint hidden sm:block">ou glisse / colle une image ici</p>
        </div>
      </div>
      {error && <p className="text-xs font-bold text-red-700">{error}</p>}
      {!hasPhoto && (
        <input
          id="image"
          name="image"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="url"
          className="field"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ou une adresse web : https://…/photo.jpg"
          aria-label="Adresse web de l'image"
        />
      )}
    </div>
  );
}

/** Vignette d'une idée ; un clic ouvre la grande version (téléchargée seulement à ce moment). */
export function IdeaThumb({ thumb, full, title }: { thumb: string; full: string; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  return (
    <>
      <button
        type="button"
        className="shrink-0 rounded-xl"
        aria-label={`Agrandir la photo de « ${title} »`}
        onClick={() => {
          setOpened(true);
          ref.current?.showModal();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="" className="size-16 rounded-xl border border-line object-cover" loading="lazy" />
      </button>
      <dialog
        ref={ref}
        onClick={() => ref.current?.close()}
        className="m-auto max-h-[92vh] max-w-[94vw] cursor-zoom-out rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-band/70 backdrop:backdrop-blur-sm open:animate-[kdo-pop_.15s_ease-out]"
      >
        {opened && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={full} alt={title} className="block max-h-[92vh] max-w-[94vw] object-contain" />
        )}
      </dialog>
    </>
  );
}
