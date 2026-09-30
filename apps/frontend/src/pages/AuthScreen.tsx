import { useEffect, useRef, useState } from "react";
import { Rss } from "lucide-react";
import { toast } from "sonner";
import { api, User as ApiUser } from "../services/api";
import { Field } from "../components/Field";
import { GoogleIcon } from "../components/GoogleIcon";
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
          locale: "en",
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
      script.src = "https://accounts.google.com/gsi/client?hl=en";
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

  const handleGoogleCredential = async (response: { credential: string }) => {
    setGoogleLoading(true);
    try {
      const res = await api.googleLogin(response.credential);
      if (res.success && res.user) {
        onAuthSuccess(res.user);
      } else {
        setError(res.error || "Google Sign-In failed");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) {
      toast.info(
        "Google Sign-In is coming soon! Please use standard email Sign In / Sign Up for now."
      );
      return;
    }
    setGoogleLoading(true);
    window.google.accounts.id.prompt();
  };

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Please fill out all fields.");
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
          setError(res.error || "Login failed");
        }
      } else {
        const res = await api.register(name, email, password);
        if (res.success) {
          const loginRes = await api.login(email, password);
          if (loginRes.success && loginRes.user) {
            onAuthSuccess(loginRes.user);
          } else {
            setError("Account created! Please sign in manually.");
            setMode("login");
          }
        } else {
          setError(res.error || "Registration failed");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tt-fade-up relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* Local brand glow decorations (the app shell already paints the mesh background) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-32 -top-32 h-80 w-80 rounded-full opacity-70 blur-3xl"
          style={{ background: "var(--brand-gradient-soft)" }}
        />
        <div
          className="absolute -bottom-36 -right-28 h-80 w-80 rounded-full opacity-60 blur-3xl"
          style={{ background: "var(--brand-gradient-soft)" }}
        />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Wordmark */}
      <div className="relative mb-12 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <div className="tt-brand-tile h-12 w-12 rounded-2xl">
            <Rss size={20} className="text-white" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-foreground">TechTalk</span>
        </div>
        <p className="text-sm text-muted-foreground">
          TikTok for tech — discover, scroll, learn.
        </p>
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
                    ? "bg-surface text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {mode === "signup" && (
              <Field label="Name" type="text" placeholder="Alex Kim" value={name} onChange={setName} />
            )}
            <Field label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
            <Field label="Password" type="password" placeholder="••••••••" value={password} onChange={setPassword} />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="tt-btn tt-btn-brand mt-2 w-full px-5 py-3 text-sm"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="tt-divider-brand flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
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
                {googleLoading ? "Signing in..." : "Continue with Google"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
