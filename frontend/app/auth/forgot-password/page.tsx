"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleForgotPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password reset instructions have been sent to your email.");
    setLoading(false);
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
                  Account recovery
                </div>

                <h1 className="text-6xl font-medium leading-[0.95] tracking-[-0.055em]">
                  Get back to
                  <br />
                  <span className="text-white/35">your documents.</span>
                </h1>

                <p className="mt-8 max-w-sm text-base leading-7 text-white/45">
                  We'll send a secure password reset link to the email
                  associated with your DocChatAI account.
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
                  Password recovery
                </div>

                <h2 className="text-4xl font-medium tracking-[-0.05em] md:text-5xl">
                  Forgot your password?
                </h2>

                <p className="mt-5 text-sm leading-7 text-black/50">
                  Enter your email and we'll send you a secure link to reset
                  your password.
                </p>
              </div>

              <form
                onSubmit={handleForgotPassword}
                className="mt-10 space-y-5"
              >
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-black/40">
                    Email address
                  </label>

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
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
                  disabled={loading}
                  className="w-full border border-black bg-black px-6 py-4 text-sm font-medium text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link"}
                  {!loading && <span className="ml-5">→</span>}
                </button>
              </form>

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