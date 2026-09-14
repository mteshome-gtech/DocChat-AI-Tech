"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
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
        <div className="grid w-full grid-cols-1 border border-black/10 bg-white lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden border-r border-black/10 bg-black p-12 text-white lg:flex lg:min-h-[650px] lg:flex-col lg:justify-between">
            <div>
              <div className="text-xl font-semibold tracking-[-0.04em]">
                DocChatAI
              </div>

              <div className="mt-32">
                <div className="mb-6 text-xs uppercase tracking-[0.25em] text-blue-400">
                  Secure account
                </div>

                <h1 className="text-6xl font-medium leading-[0.95] tracking-[-0.055em]">
                  Choose a new
                  <br />
                  <span className="text-white/35">password.</span>
                </h1>

                <p className="mt-8 max-w-sm text-base leading-7 text-white/45">
                  Create a secure password and get back to your DocChatAI
                  workspace.
                </p>
              </div>
            </div>

            <div className="text-xs uppercase tracking-[0.2em] text-white/25">
              Your documents. Understood.
            </div>
          </div>

          <div className="flex min-h-[650px] items-center p-7 sm:p-10 md:p-14">
            <div className="w-full max-w-md">
              <div className="mb-5 text-xs uppercase tracking-[0.25em] text-blue-600">
                Password reset
              </div>

              <h2 className="text-4xl font-medium tracking-[-0.05em] md:text-5xl">
                Reset your password
              </h2>

              <p className="mt-5 text-sm leading-7 text-black/50">
                Create a new password for your DocChatAI account.
              </p>

              <form onSubmit={handleReset} className="mt-10 space-y-5">
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
                    placeholder="Enter new password"
                    className="w-full border border-black/15 bg-[#fafafa] px-4 py-4 text-sm outline-none transition placeholder:text-black/25 focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-black/40">
                    Confirm password
                  </label>

                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
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
                  {loading ? "Updating..." : "Update password"}
                  {!loading && <span className="ml-5">→</span>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}