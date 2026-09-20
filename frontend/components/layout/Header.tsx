"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const router = useRouter();
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = search.trim();

    if (!query) {
      router.push("/documents");
      return;
    }

    router.push(`/documents?search=${encodeURIComponent(query)}`);
  }

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setAccountOpen(false);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign out error:", error);
        setSigningOut(false);
        return;
      }

      router.replace("/auth/signin");
      router.refresh();
    } catch (error) {
      console.error("Sign out error:", error);
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center justify-between px-6">
        <Link
          href="/dashboard"
          className="group flex items-center gap-3"
          aria-label="DocChat AI Dashboard"
        >
          <span
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              border
              border-blue-200
              bg-white
              text-base
              text-blue-600
              transition
              group-hover:border-blue-300
              group-hover:bg-blue-50
            "
          >
            ◇
          </span>

          <span
            className="
              text-sm
              font-semibold
              tracking-[0.18em]
              text-slate-900
            "
          >
            DOCCHAT AI
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <form
            onSubmit={handleSearch}
            className="relative hidden sm:block"
          >
            <svg
              className="
                pointer-events-none
                absolute
                left-3
                top-1/2
                h-4
                w-4
                -translate-y-1/2
                text-slate-400
              "
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              aria-label="Search documents"
              className="
                h-10
                w-72
                border
                border-slate-200
                bg-slate-50
                pl-10
                pr-4
                text-sm
                text-slate-900
                outline-none
                transition
                placeholder:text-slate-400
                hover:border-slate-300
                focus:border-blue-500
                focus:bg-white
                focus:ring-2
                focus:ring-blue-100
              "
            />
          </form>

          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              className="
                flex
                h-10
                items-center
                gap-2
                border
                border-transparent
                px-3
                text-sm
                font-medium
                text-slate-700
                transition
                hover:border-slate-200
                hover:bg-slate-50
              "
            >
              <span
                className="
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center
                  rounded-full
                  bg-slate-900
                  text-xs
                  font-semibold
                  text-white
                "
              >
                A
              </span>

              <span className="hidden md:block">
                Account
              </span>

              <svg
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  accountOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {accountOpen && (
              <div
                className="
                  absolute
                  right-0
                  top-12
                  w-56
                  border
                  border-slate-200
                  bg-white
                  p-2
                  shadow-xl
                "
              >
                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Account
                  </p>

                  <p className="mt-1 truncate text-sm font-medium text-slate-900">
                    Your workspace
                  </p>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setAccountOpen(false)}
                    className="
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      text-sm
                      text-slate-600
                      transition
                      hover:bg-slate-50
                      hover:text-slate-900
                    "
                  >
                    <span>⚙</span>
                    Settings
                  </Link>

                  <Link
                    href="/settings/billing"
                    onClick={() => setAccountOpen(false)}
                    className="
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      text-sm
                      text-slate-600
                      transition
                      hover:bg-slate-50
                      hover:text-slate-900
                    "
                  >
                    <span>◇</span>
                    Plan & Billing
                  </Link>

                  <Link
                    href="/documents"
                    onClick={() => setAccountOpen(false)}
                    className="
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      text-sm
                      text-slate-600
                      transition
                      hover:bg-slate-50
                      hover:text-slate-900
                    "
                  >
                    <span>▣</span>
                    My Documents
                  </Link>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      text-left
                      text-sm
                      text-red-600
                      transition
                      hover:bg-red-50
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    <span>↪</span>
                    {signingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}