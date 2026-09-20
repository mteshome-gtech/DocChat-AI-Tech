"use client";

import { FormEvent, Suspense, useState } from "react";

import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

function SignupContent() {
  const router = useRouter();

  const searchParams = useSearchParams();

  const supabase = createClient();

  const requestedPlan = searchParams.get("plan");

  const initialPlan = requestedPlan === "pro" ? "pro" : "free";

  const [plan, setPlan] = useState<"free" | "pro">(initialPlan);

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");

    if (!name || !email || !password || !confirmPassword) {
      setError("Please complete all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const redirectUrl =
      `${window.location.origin}/auth/callback?plan=${plan}`;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: name.trim(),
          selected_plan: plan,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    /*
     * If Supabase immediately created an authenticated session,
     * continue directly to the appropriate destination.
     *
     * Normally, with email confirmation enabled, there will be
     * no session here and the user will receive the verification email.
     */
    if (data.session) {
      if (plan === "pro") {
        router.replace("/settings/billing?plan=pro");
      } else {
        router.replace("/dashboard");
      }

      return;
    }

    /*
     * Email confirmation is required.
     *
     * The selected plan is preserved both:
     * 1. In the verification page URL.
     * 2. In Supabase user metadata.
     *
     * The callback can therefore recover the Pro selection even
     * if the query parameter is not preserved by the email flow.
     */
    router.replace(`/auth/verify?plan=${plan}`);
  }

  return (
    <main className="min-h-screen bg-[#f8f8f6] text-black">
      <div className="mx-auto flex min-h-screen max-w-[1400px] items-center px-6 py-12 md:px-10">
        <div className="grid w-full grid-cols-1 border border-black/10 bg-white lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[760px] bg-black p-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <Link
                href="/"
                className="text-xl font-semibold tracking-[-0.04em]"
              >
                DocChatAI
              </Link>

              <div className="mt-28">
                <div className="mb-6 text-xs uppercase tracking-[0.25em] text-blue-400">
                  Start understanding
                </div>

                <h1 className="text-7xl font-medium leading-[0.93] tracking-[-0.06em]">
                  Turn your
                  <br />
                  documents into
                  <br />
                  <span className="text-white/35">intelligence.</span>
                </h1>

                <p className="mt-9 max-w-md text-base leading-7 text-white/45">
                  Upload documents, ask questions, uncover insights, translate,
                  compare, and research from one workspace.
                </p>
              </div>
            </div>

            <div>
              <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/25">
                Included with every account
              </div>

              <div className="flex flex-wrap gap-2">
                {["DocChat", "Analysis", "Research", "Translation"].map(
                  (item) => (
                    <span
                      key={item}
                      className="border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-white/40"
                    >
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-[760px] items-center p-7 sm:p-10 md:p-14">
            <div className="w-full max-w-md">
              <Link
                href="/"
                className="text-xs uppercase tracking-[0.18em] text-black/40 transition hover:text-black"
              >
                ← Back to DocChatAI
              </Link>

              <div className="mt-10">
                <div className="mb-5 text-xs uppercase tracking-[0.25em] text-blue-600">
                  Create account
                </div>

                <h2 className="text-4xl font-medium tracking-[-0.05em] md:text-5xl">
                  Get started.
                </h2>

                <p className="mt-5 text-sm leading-7 text-black/50">
                  Create your account and start working with your documents.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 border border-black/10">
                <button
                  type="button"
                  onClick={() => setPlan("free")}
                  className={`border-r border-black/10 p-5 text-left transition ${
                    plan === "free"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-black/[0.03]"
                  }`}
                >
                  <div
                    className={`text-[10px] uppercase tracking-[0.2em] ${
                      plan === "free"
                        ? "text-white/40"
                        : "text-black/35"
                    }`}
                  >
                    Free
                  </div>

                  <div className="mt-3 text-xl font-medium">$0</div>

                  <div
                    className={`mt-2 text-xs leading-5 ${
                      plan === "free"
                        ? "text-white/45"
                        : "text-black/40"
                    }`}
                  >
                    Start exploring
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPlan("pro")}
                  className={`p-5 text-left transition ${
                    plan === "pro"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-black/[0.03]"
                  }`}
                >
                  <div
                    className={`text-[10px] uppercase tracking-[0.2em] ${
                      plan === "pro"
                        ? "text-blue-400"
                        : "text-blue-600"
                    }`}
                  >
                    Pro
                  </div>

                  <div className="mt-3 text-xl font-medium">$19.99</div>

                  <div
                    className={`mt-2 text-xs leading-5 ${
                      plan === "pro"
                        ? "text-white/45"
                        : "text-black/40"
                    }`}
                  >
                    Full workspace
                  </div>
                </button>
              </div>

              <div className="mt-7">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-black/35">
                    Selected plan
                  </span>

                  <span className="text-xs font-medium uppercase tracking-[0.15em] text-blue-600">
                    {plan === "pro"
                      ? "Pro · $19.99/mo"
                      : "Free · $0"}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSignup} className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-black/40">
                    Full name
                  </label>

                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full border border-black/15 bg-[#fafafa] px-4 py-4 text-sm outline-none transition placeholder:text-black/25 focus:border-black"
                  />
                </div>

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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-black/40">
                      Password
                    </label>

                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8+ characters"
                      className="w-full border border-black/15 bg-[#fafafa] px-4 py-4 text-sm outline-none transition placeholder:text-black/25 focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-black/40">
                      Confirm
                    </label>

                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full border border-black/15 bg-[#fafafa] px-4 py-4 text-sm outline-none transition placeholder:text-black/25 focus:border-black"
                    />
                  </div>
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
                  {loading
                    ? "Creating account..."
                    : plan === "pro"
                      ? "Continue to Pro"
                      : "Create free account"}

                  {!loading && <span className="ml-5">→</span>}
                </button>
              </form>

              <p className="mt-7 text-xs leading-6 text-black/35">
                By creating an account, you agree to use DocChatAI responsibly
                and understand that your documents are processed by the
                services powering the application.
              </p>

              <p className="mt-6 text-sm text-black/45">
                Already have an account?{" "}
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

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}