"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { restoreSeasonTheme, saveTheme } from "@/app/actions/theme";
import { DEFAULT_THEME, THEME_COOKIE, THEMES, isNoelSeason, isTheme, seasonYear, type ThemeId } from "@/lib/themes";

/** Applique le thème tout de suite (attribut sur <html>) et le mémorise dans un cookie pour le prochain affichage. */
function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}

function currentTheme(): ThemeId {
  const v = document.documentElement.dataset.theme;
  return isTheme(v) ? v : DEFAULT_THEME;
}

/**
 * Aligne l'affichage sur le thème enregistré du compte (utile sur un nouvel appareil),
 * et revient au thème d'avant une fois les fêtes passées si Noël venait de la proposition.
 */
export function ThemeSync({ theme, restore }: { theme: ThemeId | null; restore: ThemeId | null }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (theme === "noel" && restore) {
        const back = await restoreSeasonTheme().catch(() => null);
        if (back && !cancelled) return applyTheme(back);
      }
      if (!cancelled) applyTheme(theme ?? DEFAULT_THEME);
    })();
    return () => {
      cancelled = true;
    };
    // Une seule synchronisation au chargement : ensuite, le choix local fait foi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Choix du thème dans le compte : vignettes d'aperçu, application immédiate. */
export function ThemePicker({ current }: { current: ThemeId }) {
  const [selected, setSelected] = useState<ThemeId>(current);
  const [, startTransition] = useTransition();

  function choose(id: ThemeId) {
    setSelected(id);
    applyTheme(id);
    startTransition(() => saveTheme(id, null));
  }

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            data-theme={t.id}
            onClick={() => choose(t.id)}
            aria-pressed={selected === t.id}
            className={`relative overflow-hidden rounded-xl border-2 bg-white pb-2 text-center text-sm font-bold text-ink transition active:scale-[0.98] ${
              selected === t.id ? "border-brand-600 ring-2 ring-brand-600" : "border-line hover:border-brand-200"
            }`}
          >
            {t.id === "noel" && (
              <span className="absolute right-1.5 top-1.5 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-extrabold text-nav-on">
                De saison
              </span>
            )}
            <span className="band block h-8 border-b-[3px] border-accent" />
            <span className="grid h-10 place-items-center bg-paper">
              <span className="h-3 w-1/2 rounded-md" style={{ background: "linear-gradient(180deg, var(--btn-from), var(--btn-to))" }} />
            </span>
            {t.name}
            {selected === t.id && <span className="sr-only"> (thème actuel)</span>}
          </button>
        ))}
      </div>
      <p className="hint mt-3">
        Le choix est personnel et te suit sur tous tes appareils. Le thème Noël reste disponible ici toute l&apos;année.
      </p>
    </div>
  );
}

const NUDGE_KEY = "kdo-noel-nudge";

function nudgeEligible(): boolean {
  const now = new Date();
  if (!isNoelSeason(now) || currentTheme() === "noel") return false;
  try {
    return localStorage.getItem(NUDGE_KEY) !== String(seasonYear(now));
  } catch {
    return true;
  }
}

/** Proposition du thème de Noël sur l'accueil pendant les fêtes (une seule fois, refusable). */
export function NoelNudge() {
  const eligible = useSyncExternalStore(
    () => () => {},
    nudgeEligible,
    () => false,
  );
  const [hidden, setHidden] = useState(false);
  const [undo, setUndo] = useState<ThemeId | null>(null);
  const [, startTransition] = useTransition();

  function accept() {
    const before = currentTheme();
    applyTheme("noel");
    startTransition(() => saveTheme("noel", before));
    setHidden(true);
    setUndo(before);
    setTimeout(() => setUndo(null), 8000);
  }

  function revert(before: ThemeId) {
    applyTheme(before);
    startTransition(() => saveTheme(before, null));
    setUndo(null);
  }

  function decline() {
    try {
      localStorage.setItem(NUDGE_KEY, String(seasonYear(new Date())));
    } catch {}
    setHidden(true);
  }

  return (
    <>
      {eligible && !hidden && (
        <div className="mb-5 overflow-hidden rounded-2xl border-2 border-[#d4a83a] bg-[#fffaf0] text-[#1f1a17] shadow-md">
          <div
            data-theme="noel"
            className="band flex h-11 items-center gap-2 border-b-[3px] border-[#d4a83a] px-4 text-base font-extrabold"
          >
            🎄 Noël approche !
          </div>
          <div className="px-4 pb-4 pt-3 text-sm">
            <p className="mb-3">Habiller Kdo aux couleurs de Noël jusqu&apos;au 6 janvier ? Tu retrouveras ensuite ton thème.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={accept}
                className="btn text-white"
                style={{ background: "linear-gradient(180deg, #d62828, #9d0208)" }}
              >
                Essayer le thème Noël
              </button>
              <button type="button" onClick={decline} className="btn-ghost">
                Pas cette année
              </button>
            </div>
          </div>
        </div>
      )}
      {undo && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-24 z-40 flex items-center justify-between gap-3 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white shadow-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80"
        >
          <span>🎄 Thème Noël activé</span>
          <button type="button" onClick={() => revert(undo)} className="font-extrabold text-amber-300 underline">
            Annuler
          </button>
        </div>
      )}
    </>
  );
}
