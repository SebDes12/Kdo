"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { finishTour } from "@/app/actions/theme";

type Step = { target?: string; title: string; text: string };

function stepsFor(isChild: boolean, name: string): Step[] {
  return [
    {
      title: `Bienvenue sur Kdo, ${name} 🎁`,
      text: "Les idées cadeaux de la famille, sans gâcher la surprise. Voici l'essentiel en quelques étapes.",
    },
    {
      target: "evenement",
      title: "Les événements",
      text: "Chaque fête (Noël, anniversaire…) a sa zone sur l'accueil. Tu y vois les listes des autres et tu choisis ce que tu offres avec « Je le prends », seul ou à plusieurs.",
    },
    {
      target: "ma-liste",
      title: "Ta liste",
      text: "Ajoute tes idées : un titre, un lien, un prix, une photo. Tu ne sauras jamais qui t'offre quoi : la surprise est gardée.",
    },
    {
      target: "j-offre",
      title: "J'offre",
      text: "Tout ce que tu as choisi d'offrir est rassemblé ici, pour ne rien oublier le jour J.",
    },
    ...(isChild
      ? []
      : [
          {
            target: "famille",
            title: "La famille",
            text: "Invite tes proches, crée des groupes (« Côté papa », « Cousins »…) et ajoute les comptes de tes enfants.",
          },
        ]),
    {
      target: "theme",
      title: "Les couleurs",
      text: "Change le thème de Kdo quand tu veux, et pourquoi pas en Noël 🎄.",
    },
    {
      title: "C'est parti !",
      text: "Tu pourras revoir cette visite à tout moment depuis ton compte.",
    },
  ];
}

/** Premier élément visible portant ce repère (le menu existe en double : en-tête ordinateur et barre du bas). */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const CARD_W = 352;
const PAD = 6;

/**
 * Visite guidée : se lance d'elle-même à la première visite de l'accueil,
 * ou depuis le compte (/?visite=1). Les étapes dont l'élément est absent sont sautées.
 */
export function GuidedTour({ autoStart, isChild, name }: { autoStart: boolean; isChild: boolean; name: string }) {
  const pathname = usePathname();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [finished, setFinished] = useState(false);
  const next = useRef<HTMLButtonElement>(null);

  // Démarrage (après un court délai, le temps que la page soit en place)
  useEffect(() => {
    if (pathname !== "/") return;
    const replay = new URLSearchParams(window.location.search).has("visite");
    if (replay) window.history.replaceState(null, "", "/");
    if (!replay && (!autoStart || finished)) return;
    const t = setTimeout(() => {
      setSteps(stepsFor(isChild, name).filter((s) => !s.target || findTarget(s.target)));
      setIndex(0);
    }, 400);
    return () => clearTimeout(t);
  }, [pathname, autoStart, finished, isChild, name]);

  const step = steps?.[index];

  // Repérage de l'élément mis en lumière, suivi au défilement et au redimensionnement
  useEffect(() => {
    if (!step) return;
    const el = step.target ? findTarget(step.target) : null;
    if (el && !["fixed", "sticky"].includes(getComputedStyle(el.closest("header, nav") ?? el).position)) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    const raf = requestAnimationFrame(measure);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    next.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  // Échap : quitter la visite
  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function close() {
    setSteps(null);
    setRect(null);
    setFinished(true);
    finishTour().catch(() => {});
  }

  if (!steps || !step) return null;
  const last = index === steps.length - 1;
  const target = step.target ? rect : null;

  // Placement de la bulle : sous l'élément s'il y a la place, sinon au-dessus, sinon centrée
  let cardStyle: React.CSSProperties;
  if (target) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(CARD_W, vw - 24);
    const left = Math.min(Math.max(target.left + target.width / 2 - w / 2, 12), vw - w - 12);
    cardStyle =
      vh - target.bottom > 220
        ? { left, top: target.bottom + PAD + 10, width: w }
        : target.top > 220
          ? { left, bottom: vh - target.top + PAD + 10, width: w }
          : { left, bottom: 96, width: w };
  } else {
    cardStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: `min(${CARD_W}px, calc(100vw - 24px))` };
  }

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {target ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-4 ring-accent transition-all duration-300"
          style={{
            left: target.left - PAD,
            top: target.top - PAD,
            width: target.width + PAD * 2,
            height: target.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgb(20 12 30 / 0.62)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgb(20_12_30/0.62)]" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="fixed rounded-2xl bg-white p-4 text-ink shadow-2xl animate-[kdo-pop_.15s_ease-out]"
        style={cardStyle}
      >
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
          {index + 1} / {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-lg font-extrabold leading-snug">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-700">{step.text}</p>
        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <button type="button" onClick={close} className="btn-ghost -ml-3">
              Passer
            </button>
          )}
          <span className="flex-1" />
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)} className="btn-secondary">
              Retour
            </button>
          )}
          <button ref={next} type="button" onClick={() => (last ? close() : setIndex(index + 1))} className="btn-primary">
            {last ? "Terminer" : index === 0 ? "C'est parti" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
