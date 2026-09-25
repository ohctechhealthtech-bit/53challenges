import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ArrowRight, Sparkles } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import Logo from "@/components/Logo";
import { safeReturnTo } from "@/lib/authReturnTo";
import { challengeApi } from "@/lib/challengeApi";
import { setSessionToken, setAccessToken } from "@/lib/customSession";
import { useAuth } from "@/lib/AuthContext";
import { ensureGis, requestGoogleAccessToken } from "@/lib/googleSignIn";

export default function Login() {
  const navigate = useNavigate();
  const { setChallengeApiSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Google SSO: pre-load the client ID + GIS script on mount so the popup
  // fires synchronously within the click handler (browsers block popups that
  // open after an async network round-trip).
  const [googleClientId, setGoogleClientId] = useState(null);
  // Post-login destination (same-origin paths only). Preserved from the
  // boilerplate so deep links can resume after login.
  const returnTo = safeReturnTo();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await challengeApi.googleConfig();
        if (cancelled || !cfg?.clientId) return;
        setGoogleClientId(cfg.clientId);
        // Pre-load the GIS script so initTokenClient is ready by click time.
        ensureGis().catch(() => {});
      } catch {
        // Google SSO will be disabled — the button shows an error on click.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const finishLogin = (res) => {
    if (res?.requiresVerification || res?.requires_verification) {
      navigate("/verify-email", { state: { email } });
      return;
    }
    if (res?.success && res?.user) {
      setSessionToken(res.session_token);
      // Read by the SDK on the next page load and sent as a bearer header, which
      // is the only credential the entity API can see.
      setAccessToken(res.access_token);
      setChallengeApiSession(res.user);
      // Hard redirect so the AuthProvider re-initializes and picks up the
      // new Challenge-API session from storage. Default to the user's
      // dashboard; fall back to an explicit deep link when one was requested.
      window.location.href = returnTo !== "/" ? returnTo : "/my-dashboard";
    } else {
      setError(res?.error || "Invalid email or password");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await challengeApi.login({ email, password });
      finishLogin(res);
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    if (!googleClientId) {
      setError("Google sign-in is not configured. Please try again or use email login.");
      return;
    }
    setLoading(true);
    try {
      // GIS script already pre-loaded on mount; this popup fires synchronously
      // within the user gesture so browsers won't block it.
      await ensureGis();
      const accessToken = await requestGoogleAccessToken(googleClientId);
      const res = await challengeApi.googleLogin({ access_token: accessToken });
      finishLogin(res);
    } catch (err) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden gradient-hero p-12 xl:p-16">
        <div className="absolute -inset-20 -z-10 bg-purple-600/20 blur-3xl" />
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-14 w-auto" />
        </Link>

        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[--accent]">
            <Sparkles className="h-4 w-4" /> Australia's Creative Competition Platform
          </p>
          <h1 className="mt-5 font-heading text-5xl font-extrabold leading-[1.05] tracking-tight">
            Post. Compete.<br /><span className="grad-text">Get Voted.</span>
          </h1>
          <p className="mt-5 max-w-md text-muted-foreground">
            Log in to submit entries, track your submissions, and vote for the creators who move you.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-primary font-bold">1</span>
              Join live challenges across Australia
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-primary font-bold">2</span>
              Submit your work and track review status
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-primary font-bold">3</span>
              Vote and climb the leaderboard
            </li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} 53 Challenges</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo className="h-14 w-auto" />
          </div>

          <h2 className="font-heading text-3xl font-extrabold">Welcome back</h2>
          <p className="mt-2 text-muted-foreground">Log in to your account to continue.</p>

          <Button variant="outline" className="w-full h-12 mt-7 mb-5 font-medium" onClick={handleGoogle} disabled={loading}>
            <GoogleIcon className="w-5 h-5 mr-2" /> Continue with Google
          </Button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">or</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full h-12 items-center justify-center gap-2 rounded-xl grad-bg text-sm font-bold text-white shadow-lg shadow-purple-900/40 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</>
              ) : (
                <>Log in <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
              className="text-primary font-medium hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}