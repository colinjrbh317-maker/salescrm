"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** Map raw Supabase error messages to user-friendly text */
function friendlyError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials"))
    return "Incorrect email or password. Please try again.";
  if (lower.includes("email not confirmed"))
    return "Please check your inbox and confirm your email before signing in.";
  if (lower.includes("user already registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (lower.includes("signup is not allowed") || lower.includes("signups not allowed"))
    return "New account registration is currently disabled. Contact your admin.";
  if (lower.includes("rate limit") || lower.includes("too many requests"))
    return "Too many attempts. Please wait a moment and try again.";
  if (lower.includes("password") && lower.includes("short"))
    return "Password must be at least 6 characters.";

  return message;
}

type AuthMode = "login" | "signup" | "forgot";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Capture return-to URL from middleware redirect
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  // Capture error from auth callback
  const callbackError = searchParams.get("error");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(friendlyError(error.message));
      setLoading(false);
      return;
    }

    setSuccess("Signed in! Redirecting...");
    router.push(redirectTo);
    router.refresh();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(friendlyError(error.message));
      setLoading(false);
      return;
    }

    // Profile is created automatically by the database trigger — no client-side upsert needed

    if (data.user && data.session) {
      setSuccess("Account created! Redirecting...");
      router.push(redirectTo);
      router.refresh();
    } else if (data.user && !data.session) {
      setSuccess(
        "Account created! Check your email for a confirmation link, then sign in."
      );
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError(friendlyError(error.message));
      setLoading(false);
      return;
    }

    setSuccess(
      "If an account exists with that email, you will receive a password reset link."
    );
    setLoading(false);
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  }

  const headings: Record<AuthMode, { title: string; subtitle: string }> = {
    login: { title: "Welcome Back", subtitle: "Sign in to your account" },
    signup: { title: "Get Started", subtitle: "Create a new account" },
    forgot: { title: "Reset Password", subtitle: "We'll send you a reset link" },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">
            {headings[mode].title}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {headings[mode].subtitle}
          </p>
        </div>

        <form
          onSubmit={
            mode === "login"
              ? handleLogin
              : mode === "signup"
              ? handleSignup
              : handleForgotPassword
          }
        >
          {mode === "signup" && (
            <div className="mb-4">
              <label
                htmlFor="fullName"
                className="mb-1 block text-sm font-medium text-slate-300"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Jane Smith"
                required
              />
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="you@company.com"
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="mb-2">
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </div>
          )}

          {mode === "login" && (
            <div className="mb-6 text-right">
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-xs text-slate-400 hover:text-blue-400"
              >
                Forgot password?
              </button>
            </div>
          )}

          {mode !== "login" && <div className="mb-4" />}

          {(error || callbackError) && (
            <div className="mb-4 rounded-md border border-red-700 bg-red-900/50 px-3 py-2 text-sm text-red-300">
              {error ?? callbackError}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-md border border-emerald-700 bg-emerald-900/50 px-3 py-2 text-sm text-emerald-300">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {mode === "login"
                  ? "Signing in..."
                  : mode === "signup"
                  ? "Creating account..."
                  : "Sending link..."}
              </span>
            ) : mode === "login" ? (
              "Sign In"
            ) : mode === "signup" ? (
              "Create Account"
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center">
          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="block w-full text-sm text-blue-400 hover:text-blue-300"
            >
              Need an account? Sign up
            </button>
          )}
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="block w-full text-sm text-blue-400 hover:text-blue-300"
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="block w-full text-sm text-blue-400 hover:text-blue-300"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
