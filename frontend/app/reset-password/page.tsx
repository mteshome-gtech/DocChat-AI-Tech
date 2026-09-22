"use client";

import { FormEvent, useEffect, useState } from "react";

import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "This password reset link is invalid or has expired. Please request a new reset link."
        );
      }

      setCheckingSession(false);
    }

    checkSession();
  }, [supabase]);

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    if (password.length < 6) {
      setError("Your new password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "Your password has been updated. Redirecting to your dashboard..."
    );

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1200);
  }

  return (
    <main className="min-h-screen bg-[#f8f8f6] text-black">
      <div className="mx-auto flex min-h-screen max-w-[1400px] items-center px-6 py-16 md:px-10">
        <div className="grid w-full grid-cols-1 border border-black/10 bg-white lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden border-r border-black/10 bg-black p-12 text-white lg:flex lg:min-h-[650px] lg:flex-col lg:justify-between">
            <div>
              <Link
                href="/"
                className="text-xl font-semibold tracking-[-0.04em]"
              >
                DocChatAI
              </Link>

              <div className="mt-32 max-w-md">
                <div className="mb-6 text-xs uppercase tracking-[0.25em] text-blue-400">
                  Account security
                </div>

                <h1 className="text-6xl font-medium leading-[0.95] tracking-[-0.055em]">
                  Create a new
                  <br />
                  <span className="text-white/35">password.</span>
                </h1>

                <p className="mt-8 max-w-sm text-base leading-7 text-white/45">
                  Choose a new password to secure your DocChatAI account and
                  get back to your intelligent document workspace.
                </p>
              </div>
            </div>

            <div className="text-xs uppercase tracking-[0.2em] text-white/25">
              Intelligent document workspace
            </div>
          </div>

          <div className="flex min-h-[650px] items-center p-7 sm:p-10 md:p-14">
            <div className="w-full max-w-md">
              <Link
                href="/auth/signin"
                className="text-xs uppercase tracking-[0.18em] text-black/40 transition hover:text-black"
              >
                ← Back to sign in
              </Link>

              <div className="mt-14">
                <div className="mb-5 text-xs uppercase tracking-[0.25em] text-blue-600">
                  Password reset
                </div>

                <h2 className="text-4xl font-medium tracking-[-0.05em] md:text-5xl">
                  Create a new password
                </h2>

                <p className="mt-5 text-sm leading-7 text-black/50">
                  Enter a new password below. Once updated, you'll be taken
                  directly to your DocChatAI dashboard.
                </p>
              </div>

              {checkingSession ? (
                <div className="mt-10 border border-black/10 bg-[#fafafa] px-4 py-4 text-sm leading-6 text-black/50">
                  Verifying your password reset link...
                </div>
              ) : (
                <form
                  onSubmit={handleResetPassword}
                  className="mt-10 space-y-5"
                >
                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-black/40">
                      New password
                    </label>

                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your new password"
                      className="w-full border border-black/15 bg-[#fafafa] px-4 py-4 text-sm outline-none transition placeholder:text-black/25 focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-black/40">
                      Confirm new password
                    </label>

                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      className="w-full border border-black/15 bg-[#fafafa] px-4 py-4 text-sm outline-none transition placeholder:text-black/25 focus:border-black"
                    />
                  </div>

                  {error && (
                    <div className="border border-red-500/20 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="border border-emerald-500/20 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !!message}
                    className="w-full border border-black bg-black px-6 py-4 text-sm font-medium text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Updating password..." : "Update password"}

                    {!loading && !message && (
                      <span className="ml-5">→</span>
                    )}
                  </button>
                </form>
              )}

              <p className="mt-8 text-sm text-black/45">
                Remember your password?{" "}
                <Link
                  href="/auth/signin"
                  className="font-medium text-black transition hover:text-blue-600"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}