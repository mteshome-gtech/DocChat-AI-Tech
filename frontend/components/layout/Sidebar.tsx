"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { PLAN_FEATURES, type Plan } from "@/lib/plans";

type NavItem = {
  label: string;
  href: string;
  feature?: keyof typeof PLAN_FEATURES.free;
  icon: string;
};

const workspaceItems: NavItem[] = [
  {
    label: "Chat",
    href: "/chat",
    feature: "chat",
    icon: "◉",
  },
  {
    label: "Documents",
    href: "/documents",
    feature: "documents",
    icon: "▣",
  },
  {
    label: "Upload",
    href: "/documents/upload",
    feature: "upload",
    icon: "↑",
  },
  {
    label: "Translate",
    href: "/translate",
    feature: "translate",
    icon: "文",
  },
];

const aiItems: NavItem[] = [
  {
    label: "Analyze",
    href: "/analyze",
    feature: "analyze",
    icon: "✦",
  },
  {
    label: "Compare",
    href: "/compare",
    feature: "compare",
    icon: "⇄",
  },
  {
    label: "Research",
    href: "/research",
    feature: "research",
    icon: "◎",
  },
];

const PRO_ROUTES = [
  "/translate",
  "/analyze",
  "/compare",
  "/research",
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [plan, setPlan] = useState<Plan>("free");

  const loadPlan = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPlan("free");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Failed to load plan:", error);
      return;
    }

    const nextPlan: Plan =
      data?.plan === "pro" ? "pro" : "free";

    setPlan(nextPlan);

    if (
      nextPlan === "free" &&
      PRO_ROUTES.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(`${route}/`)
      )
    ) {
      router.replace("/dashboard");
    }
  }, [pathname, router, supabase]);

  useEffect(() => {
    loadPlan();

    const handlePlanUpdated = () => {
      loadPlan();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadPlan();
      }
    };

    const handleFocus = () => {
      loadPlan();
    };

    window.addEventListener(
      "docchat-plan-updated",
      handlePlanUpdated
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener(
        "docchat-plan-updated",
        handlePlanUpdated
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener("focus", handleFocus);
    };
  }, [loadPlan]);

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-slate-800 bg-[#0b0d10] text-white">
      <div className="flex h-20 items-center border-b border-slate-800 px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
        >
          <span className="flex h-8 w-8 items-center justify-center border border-blue-400/40 text-sm text-blue-300">
            ◇
          </span>

          <span className="text-sm font-semibold tracking-[0.18em]">
            DOCCHAT AI
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-7">
        <NavSection
          title="Workspace"
          items={workspaceItems}
          pathname={pathname}
          plan={plan}
        />

        <NavSection
          title="AI Tools"
          items={aiItems}
          pathname={pathname}
          plan={plan}
        />

        <div className="my-7 border-t border-slate-800" />

        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Account
        </p>

        <Link
          href="/settings/billing"
          className={`group flex items-center gap-3 px-3 py-2.5 text-sm transition ${
            pathname.startsWith("/settings/billing")
              ? "bg-white/[0.07] text-white"
              : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
          }`}
        >
          <span className="w-5 text-center text-xs">
            ◇
          </span>

          Plan & Billing
        </Link>

        <Link
          href="/settings"
          className={`group mt-1 flex items-center gap-3 px-3 py-2.5 text-sm transition ${
            pathname === "/settings"
              ? "bg-white/[0.07] text-white"
              : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
          }`}
        >
          <span className="w-5 text-center text-xs">
            ⚙
          </span>

          Settings
        </Link>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="border border-slate-800 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Current Plan
            </span>

            <span className="text-xs font-medium capitalize text-blue-300">
              {plan}
            </span>
          </div>

          <div className="mt-3 h-px bg-slate-800" />

          {plan === "free" ? (
            <>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Unlock advanced document intelligence.
              </p>

              <Link
                href="/settings/billing"
                className="mt-4 block text-xs font-medium text-blue-300 transition hover:text-blue-200"
              >
                Upgrade to Pro →
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Advanced document intelligence unlocked.
              </p>

              <Link
                href="/settings/billing"
                className="mt-4 block text-xs font-medium text-slate-300 transition hover:text-white"
              >
                Manage Plan →
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavSection({
  title,
  items,
  pathname,
  plan,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  plan: Plan;
}) {
  const visibleItems = items.filter((item) => {
    if (!item.feature) return true;

    return PLAN_FEATURES[plan][item.feature];
  });

  return (
    <section className="mb-7">
      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {title}
      </p>

      <div className="space-y-1">
        {visibleItems.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span
                className={`flex w-5 justify-center text-xs ${
                  active
                    ? "text-blue-300"
                    : "text-slate-500 group-hover:text-slate-300"
                }`}
              >
                {item.icon}
              </span>

              <span className="flex-1">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}