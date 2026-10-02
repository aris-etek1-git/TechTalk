import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Github } from "lucide-react";
import { api, User as ApiUser } from "../services/api";
import { Field } from "../components/Field";
import { GoogleIcon } from "../components/GoogleIcon";
import { BrandMark, BrandWord } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            moment_listener?: (notification: { isSkippedMoment: () => boolean }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface AuthScreenProps {
  onAuthSuccess: (user: ApiUser) => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const gisInitialized = useRef(false);
  const lastWidth = useRef(0);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let observer: ResizeObserver | null = null;

    const setupGis = () => {
      const gis = window.google?.accounts?.id;
      if (!gis || !googleBtnRef.current || gisInitialized.current) return;
      gisInitialized.current = true;

      gis.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });

      const renderButton = () => {
        const container = googleBtnRef.current;
        if (!container || !gis) return;
        const width = Math.max(container.clientWidth || 320, 200);
        if (lastWidth.current === width) return;
        lastWidth.current = width;
        gis.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          width,
          text: "continue_with",
          locale: "fr",
        });
      };

      renderButton();
      observer = new ResizeObserver(renderButton);
      observer.observe(googleBtnRef.current);
    };

    if (window.google?.accounts?.id) {
      setupGis();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=fr";
      script.async = true;
      script.defer = true;
      script.onload = setupGis;
      document.body.appendChild(script);
    }

    return () => {
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §49 OAuth: the GitHub callback returns to /login with the session in the URL
  // fragment. Adopt it, then scrub the fragment so the token is not left in
  // history or visible in the address bar.
  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const token = params.get("gh_token");
    const error = params.get("gh_error");
    const unavailable = params.get("gh_unavailable");

    if (!token && !error && !unavailable) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);

    if (unavailable) {
      setError("La connexion GitHub n'est pas configurée sur ce serveur.");
      return;
    }
    if (error) {
      setError(
        error === "cancelled"
          ? "Connexion GitHub annulée."
          : "La connexion GitHub a échoué. Réessayez ou utilisez l'e-mail."
      );
      return;
    }
    if (token) {
      setGithubLoading(true);
      api
        .adoptGithubToken(token)
        .then((res) => {
          if (res.success && res.user) onAuthSuccess(res.user);
          else setError(res.error || "La connexion GitHub a échoué.");
        })
        .finally(() => setGithubLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCredential = async (response: { credential: string }) => {
    setGoogleLoading(true);
    try {
      const res = await api.googleLogin(response.credential);
      if (res.success && res.user) {
        onAuthSuccess(res.user);
      } else {
        setError(res.error || "La connexion Google a échoué.");
      }
    } catch {
      setError("Une erreur inattendue est survenue. Réessayez.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) {
      toast.info(
        "La connexion Google arrive bientôt. Utilisez l’e-mail pour l’instant."
      );
      return;
    }
    setGoogleLoading(true);
    window.google.accounts.id.prompt();
  };

  const handleGithubClick = () => {
    setGithubLoading(true);
    window.location.assign(api.githubStartUrl());
  };

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Merci de remplir tous les champs.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await api.login(email, password);
        if (res.success && res.user) {
          onAuthSuccess(res.user);
        } else {
          setError(res.error || "Connexion impossible.");
        }
      } else {
        const res = await api.register(name, email, password);
        if (res.success) {
          const loginRes = await api.login(email, password);
          if (loginRes.success && loginRes.user) {
            onAuthSuccess(loginRes.user);
          } else {
            setError("Compte créé ! Connectez-vous.");
            setMode("login");
          }
        } else {
          setError(res.error || "L’inscription a échoué.");
        }
      }
    } catch (err) {
      setError("Une erreur inattendue est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tt-fade-up relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Wordmark */}
      <div className="relative mb-10 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <BrandMark size={44} radius="12px" glyph={21} />
          <BrandWord size="text-3xl" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Le contenu tech, réuni.</p>
      </div>

      <div className="relative w-full max-w-sm">
        <div className="tt-card p-6 sm:p-8">
          {/* Mode toggle */}
          <div className="mb-8 flex gap-1 rounded-full border border-border bg-surface-2 p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${
                  mode === m
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Se connecter" : "S’inscrire"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {mode === "signup" && (
              <Field label="Nom" type="text" placeholder="Alex Kim" value={name} onChange={setName} />
            )}
            <Field label="Adresse e-mail" type="email" placeholder="vous@exemple.com" value={email} onChange={setEmail} />
            <Field label="Mot de passe" type="password" placeholder="••••••••" value={password} onChange={setPassword} />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="tt-btn tt-btn-brand mt-2 w-full px-5 py-3 text-sm"
            >
              {loading ? "Patientez…" : mode === "login" ? "Se connecter" : "Créer un compte"}
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="tt-divider-brand flex-1" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="tt-divider-brand flex-1" />
            </div>

            {GOOGLE_CLIENT_ID && !googleLoading ? (
              <div ref={googleBtnRef} className="w-full h-12" />
            ) : (
              <button
                onClick={handleGoogleClick}
                disabled={googleLoading}
                className="tt-btn tt-btn-ghost w-full px-4 py-3 text-sm"
              >
                <GoogleIcon />
                {googleLoading ? "Connexion…" : "Continuer avec Google"}
              </button>
            )}

            <button
              onClick={handleGithubClick}
              disabled={githubLoading}
              className="tt-btn tt-btn-ghost w-full gap-2 px-4 py-3 text-sm"
            >
              <Github size={17} /> {githubLoading ? "Connexion…" : "Continuer avec GitHub"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
