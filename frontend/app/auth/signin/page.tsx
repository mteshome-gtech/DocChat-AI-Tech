"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SigninPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f8f8f6] text-black">
      <div className="mx-auto flex min-h-screen max-w-[1400px] items-center px-6 py-16 md:px-10">
        <div className="grid w-full grid-cols-1 border border-black/10 bg-white lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[700px] bg-black p-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <Link
                href="/"
                className="text-xl font-semibold tracking-[-0.04em]"
              >
                DocChatAI
              </Link>

              <div className="mt-32 max-w-xl">
                <div className="mb-6 text-xs uppercase tracking-[0.25em] text-blue-400">
                  Intelligent document workspace
                </div>

                <h1 className="text-7xl font-medium leading-[0.93] tracking-[-0.06em]">
                  Your documents.
                  <br />
                  <span className="text-white/35">Understood.</span>
                </h1>

                <p className="mt-9 max-w-md text-base leading-7 text-white/45">
                  Ask questions, analyze complex documents, translate,
                  compare, and research from one intelligent workspace.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/25">
              <span className="h-2 w-2 bg-blue-500" />
              DocChatAI
            </div>
          </div>

          <div className="flex min-h-[700px] items-center p-7 sm:p-10 md:p-14">
            <div className="w-full max-w-md">
              <Link
                href="/"
                className="text-xs uppercase tracking-[0.18em] text-black/40 transition hover:text-black"
              >
                ← Back to DocChatAI
              </Link>

              <div className="mt-14">
                <div className="mb-5 text-xs uppercase tracking-[0.25em] text-blue-600">
                  Welcome back
                </div>

                <h2 className="text-4xl font-medium tracking-[-0.05em] md:text-5xl">
                  Sign in.
                </h2>

                <p className="mt-5 text-sm leading-7 text-black/50">
                  Continue to your DocChatAI workspace.
                </p>
              </div>

              <form onSubmit={handleSignin} className="mt-10 space-y-5">
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

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-black/40">
                      Password
                    </label>

                    <Link
                      href="/auth/forgot-password"
                      className="text-xs text-black/40 transition hover:text-blue-600"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full border border-black/15 bg-[#fafafa] px-4 py-4 text-sm outline-none transition placeholder:text-black/25 focus:border-black"
                  />
                </div>

                {error && (
                  <div className="border border-red-500/20 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full border border-black bg-black px-6 py-4 text-sm font-medium text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign in"}
                  {!loading && <span className="ml-5">→</span>}
                </button>
              </form>

              <div className="my-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-black/10" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-black/25">
                  Or
                </span>
                <div className="h-px flex-1 bg-black/10" />
              </div>

              <p className="text-sm text-black/45">
                Don't have an account?{" "}
                <Link
                  href="/auth/signup?plan=free"
                  className="font-medium text-black transition hover:text-blue-600"
                >
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}