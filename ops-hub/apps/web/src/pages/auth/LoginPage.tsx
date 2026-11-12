import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  getToken,
  login,
  useSession,
  useSetSession,
} from "../../lib/auth/store";
import { useT } from "../../lib/i18n";
import { ApiError } from "../../lib/api/client";
import { problemMessage } from "../../lib/api/problem-message";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";

/**
 * Epic-design cinematic login (UI_PLAN §9): a full-viewport split with a
 * dark `#003520` scene panel at the inline start and the warm form side.
 * Depth system: 0 gradient atmosphere → 1 blurred glow blobs → 2 floating
 * geometric shapes → 3 brand mark → 4 headline + features. Pure CSS/SVG —
 * no image assets. `prefers-reduced-motion` kills all animation; touch
 * devices (pointer: coarse) drop the floating layers entirely.
 */

const SCENE_CSS = `
.lgx-scene{position:absolute;inset:0;overflow:hidden;background:
  radial-gradient(120% 90% at 72% 12%, rgba(26,138,92,0.28), transparent 62%),
  linear-gradient(155deg, var(--flora-primary-dark) 0%, var(--flora-primary-darkest) 100%);}
.lgx-blob{position:absolute;border-radius:9999px;filter:blur(48px);pointer-events:none;}
.lgx-blob-gold{width:30rem;height:30rem;top:-8rem;inset-inline-end:-10rem;background:
  radial-gradient(closest-side, rgba(197,163,77,0.34), rgba(197,163,77,0) 72%);
  animation:lgx-drift 24s ease-in-out infinite alternate;}
.lgx-bloom{width:26rem;height:26rem;bottom:-10rem;inset-inline-start:-8rem;background:
  radial-gradient(closest-side, rgba(26,138,92,0.42), rgba(26,138,92,0) 70%);
  animation:lgx-drift 30s ease-in-out infinite alternate-reverse;}
.lgx-shape{position:absolute;pointer-events:none;animation:lgx-float 10s ease-in-out infinite alternate;}
.lgx-shape-ring{width:6rem;height:6rem;border:2px solid rgba(197,163,77,0.38);border-radius:9999px;
  top:18%;inset-inline-start:12%;animation-duration:9s;}
.lgx-shape-square{width:4rem;height:4rem;border:2px solid rgba(26,138,92,0.55);border-radius:1rem;
  top:56%;inset-inline-end:14%;animation-duration:12s;animation-delay:-4s;}
.lgx-shape-dot{width:1.25rem;height:1.25rem;background:rgba(26,138,92,0.4);border-radius:0.375rem;
  top:36%;inset-inline-end:26%;animation-duration:7s;animation-delay:-2s;}
.lgx-shape-chip{width:2.5rem;height:2.5rem;background:rgba(197,163,77,0.16);border-radius:0.75rem;
  bottom:14%;inset-inline-start:22%;animation-duration:14s;animation-delay:-6s;}
.lgx-rise{animation:lgx-rise 640ms cubic-bezier(0.22,1,0.36,1) backwards;}
.lgx-elastic{animation:lgx-elastic 720ms cubic-bezier(0.34,1.56,0.64,1) backwards;}
.lgx-d1{animation-delay:120ms;}.lgx-d2{animation-delay:260ms;}.lgx-d3{animation-delay:400ms;}
@keyframes lgx-rise{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes lgx-elastic{0%{opacity:0;transform:scale(0.82);}60%{opacity:1;transform:scale(1.05);}100%{opacity:1;transform:scale(1);}}
@keyframes lgx-float{from{transform:translateY(-9px) rotate(-5deg);}to{transform:translateY(11px) rotate(6deg);}}
@keyframes lgx-drift{from{transform:translate(-3%,-2%) scale(1);}to{transform:translate(4%,7%) scale(1.07);}}
.lgx-coarse .lgx-blob,.lgx-coarse .lgx-shape{display:none;}
@media (prefers-reduced-motion:reduce){
  .lgx-scene,.lgx-scene *,.lgx-scene *::before,.lgx-scene *::after{
    animation:none !important;transition:none !important;}
}
`;

/** Touch devices get the reduced scene (epic-design rule 9). */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    () => window.matchMedia("(pointer: coarse)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const onChange = (event: MediaQueryListEvent): void => {
      setCoarse(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return coarse;
}

/** Depth-2 floating decorative geometric shape. */
function Shape({ variant }: { variant: "ring" | "square" | "dot" | "chip" }) {
  return (
    <span aria-hidden="true" className={`lgx-shape lgx-shape-${variant}`} />
  );
}

/** Gold-dot feature bullet on the dark panel. */
function Feature({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-pill bg-secondary-light"
      />
      <span className="text-body2 font-semibold text-white/80">{children}</span>
    </li>
  );
}

/** Depth-3 brand mark: inline botanical SVG + wordmark. */
function BrandMark() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 lg:items-start">
      <svg
        width="52"
        height="52"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="24"
          cy="24"
          r="21.5"
          stroke="var(--flora-secondary)"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        <path
          d="M24 35C14.5 31 14.5 19 24 12c9.5 7 9.5 19 0 23Z"
          fill="var(--flora-primary-lightest)"
        />
        <path
          d="M24 16v17"
          stroke="var(--flora-secondary-light)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col items-center gap-1 lg:items-start">
        <span className="text-heading5 font-extrabold tracking-wide text-white">
          Operix
        </span>
        <span className="text-caption font-semibold text-secondary-light">
          {t("login.brandTagline")}
        </span>
      </div>
    </div>
  );
}

/** Inline-start cinematic panel (56vw desktop, slim top banner on mobile). */
function ScenePanel({ coarse }: { coarse: boolean }) {
  const t = useT();
  return (
    <section
      className={`relative flex flex-col justify-center overflow-hidden bg-primary-darkest px-6 py-8 lg:h-dvh lg:w-[56vw] lg:px-16 lg:py-0 ${coarse ? "lgx-coarse" : ""}`}
    >
      <style>{SCENE_CSS}</style>
      {/* depth-0/1/2: atmosphere, glow, floating geometry — decorative */}
      <div className="lgx-scene" aria-hidden="true">
        <span aria-hidden="true" className="lgx-blob lgx-blob-gold" />
        <span aria-hidden="true" className="lgx-blob lgx-bloom" />
        <Shape variant="ring" />
        <Shape variant="square" />
        <Shape variant="dot" />
        <Shape variant="chip" />
      </div>

      {/* depth-3 brand */}
      <div className="relative z-10 lgx-elastic">
        <BrandMark />
      </div>

      {/* depth-4 headline + features */}
      <div className="relative z-10 mt-6 flex flex-col items-center gap-4 text-center lg:mt-10 lg:items-start lg:text-start">
        <h1 className="lgx-rise lgx-d1 max-w-xl text-heading4 font-extrabold leading-tight text-white lg:text-heading3">
          {t("login.headline")}
        </h1>
        <p className="lgx-rise lgx-d2 max-w-md text-body1 text-white/75">
          {t("login.subheadline")}
        </p>
        <ul className="lgx-rise lgx-d3 hidden flex-col gap-2.5 lg:flex">
          <Feature>{t("login.feature.orders")}</Feature>
          <Feature>{t("login.feature.inventory")}</Feature>
          <Feature>{t("login.feature.cod")}</Feature>
        </ul>
      </div>
    </section>
  );
}

/** End side: warm background + the login card (existing auth wiring). */
function LoginCard() {
  const t = useT();
  const navigate = useNavigate();
  const { session, isLoading } = useSession();
  const setSession = useSetSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or boot validated) → straight to the console.
  if (!isLoading && (session !== null || getToken() !== null)) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const session = await login({ email: email.trim(), password });
      setSession(session);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        problemMessage(
          err,
          err instanceof ApiError ? t("login.failed") : t("state.error"),
        ),
      );
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm p-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <h2 className="text-heading5 font-extrabold text-ink-900">
          {t("login.cardTitle")}
        </h2>
        <p className="text-body2 text-ink-600">{t("login.cardSubtitle")}</p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label={t("login.email")}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder={t("login.emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label={t("login.password")}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error !== null ? (
          <p
            role="alert"
            className="rounded-sm bg-alert-light px-3 py-2 text-body2 font-semibold text-alert"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={submitting} className="mt-2">
          {t("action.login")}
        </Button>
        <p className="mt-1 text-center text-caption text-ink-500">
          {t("login.secureNote")}
        </p>
      </form>
    </Card>
  );
}

export function LoginPage() {
  const coarse = useCoarsePointer();
  return (
    <main className="flex min-h-dvh flex-col bg-bg lg:flex-row">
      <ScenePanel coarse={coarse} />
      <div className="flex flex-1 items-center justify-center p-4 lg:h-dvh">
        <LoginCard />
      </div>
    </main>
  );
}
