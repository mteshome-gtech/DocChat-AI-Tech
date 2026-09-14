"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") === "pro" ? "pro" : "free";

  return (
    <main className="min-h-screen bg-[#f8f8f6] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[0.85fr_1.15fr]">
        <section className="hidden bg-[#0b0d10] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center border border-blue-400/40 text-sm text-blue-300">
              ◇
            </span>

            <span className="text-sm font-semibold tracking-[0.18em]">
              DOCCHAT AI
            </span>
          </Link>

          <div>
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-300">
              Almost there
            </p>

            <h1 className="max-w-md text-5xl font-semibold leading-[1.05] tracking-tight">
              One click away from your workspace.
            </h1>

            <p className="mt-6 max-w-md text-sm leading-6 text-slate-400">
              Confirm your email address and we’ll automatically take you
              into DocChat AI.
            </p>
          </div>

          <p className="text-xs text-slate-600">
            Intelligent document workflows.
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center border border-blue-200 bg-blue-50 text-xl text-blue-600">
                  ✓
                </div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-600">
                  Check your inbox
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  Verify your email
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  We sent you a verification link. Click the link in the
                  email and you’ll be automatically signed in and taken
                  to your workspace.
                </p>
              </div>

              <div className="border border-slate-200 bg-[#f8f8f6] p-5">
                <div className="flex items-start gap-4">
                  <div className="text-lg text-blue-600">
                    ✉
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Email verification
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      No additional sign-in is required after you
                      confirm your email.
                    </p>
                  </div>
                </div>
              </div>

              {plan === "pro" && (
                <div className="mt-5 border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-medium text-blue-900">
                    Pro selected
                  </p>

                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    After verification, you’ll be automatically taken to
                    Stripe to securely complete your Pro subscription.
                  </p>
                </div>
              )}

              <div className="mt-8 border-t border-slate-200 pt-6">
                <Link
                  href="/auth/signin"
                  className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
                >
                  Back to sign in →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}