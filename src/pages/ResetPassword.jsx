import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { challengeApi } from "@/lib/challengeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  // Reset emails can arrive with the token under a few different names (and
  // occasionally after the #). Accept them all so a valid link always works.
  const hashParams = new URLSearchParams(
    window.location.hash.includes("?") ? window.location.hash.split("?")[1] : window.location.hash.replace(/^#/, "")
  );
  const pick = (k) => searchParams.get(k) || hashParams.get(k);
  const resetToken = pick("token") || pick("reset_token") || pick("resetToken") || pick("t") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenState, setTokenState] = useState("checking");

  // Check the link before showing the form, so an expired or already-used link
  // says so straight away instead of failing on submit.
  useEffect(() => {
    if (!resetToken) return;
    let active = true;
    (async () => {
      try {
        const res = await challengeApi.verifyReset(resetToken);
        if (!active) return;
        if (res?.valid === false) {
          setTokenState("invalid");
          setError(res.error || "This password reset link has expired.");
          return;
        }
        setTokenState("valid");
      } catch {
        if (active) setTokenState("valid");
      }
    })();
    return () => { active = false; };
  }, [resetToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await challengeApi.resetPassword({ token: resetToken, new_password: newPassword });
      if (res?.success) {
        window.location.href = "/login";
      } else {
        setError(res?.error || "Failed to reset password");
      }
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (resetToken && tokenState === "checking") {
    return (
      <AuthLayout icon={Lock} title="New password" subtitle="Checking your reset link">
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    );
  }

  if (resetToken && tokenState === "invalid") {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Link expired"
        subtitle="This password reset link is no longer valid"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          {error || "Reset links last 30 minutes and can only be used once. Please request a new one."}
        </p>
      </AuthLayout>
    );
  }

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is missing or invalid"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          The link you used appears to be incomplete. Please request a new password reset email.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="New password"
      subtitle="Enter your new password below"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}