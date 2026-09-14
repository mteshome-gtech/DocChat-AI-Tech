"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Plan = "free" | "pro" | "business";

type Profile = {
  full_name: string | null;
  workspace_name: string | null;
  language: string | null;
  auto_save_conversations: boolean | null;
  ai_response_style: string | null;
  email_notifications: boolean | null;
  plan: Plan | null;
  subscription_status: string | null;
};

export default function SettingsPage() {
  const supabase = createClient();

  const [workspaceName, setWorkspaceName] = useState("DocChatAI");
  const [language, setLanguage] = useState("English");
  const [autoSave, setAutoSave] = useState(true);
  const [responseStyle, setResponseStyle] = useState("Balanced");
  const [emailNotifications, setEmailNotifications] = useState(true);

  const [plan, setPlan] = useState<Plan>("free");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState("inactive");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select(
              `
                full_name,
                workspace_name,
                language,
                auto_save_conversations,
                ai_response_style,
                email_notifications,
                plan,
                subscription_status
              `
            )
            .eq("id", user.id)
            .single();

        if (profileError) {
          throw profileError;
        }

        if (profile) {
          const data = profile as Profile;

          setWorkspaceName(
            data.workspace_name || "DocChatAI"
          );

          setLanguage(data.language || "English");

          setAutoSave(
            data.auto_save_conversations ?? true
          );

          setResponseStyle(
            data.ai_response_style || "Balanced"
          );

          setEmailNotifications(
            data.email_notifications ?? true
          );

          setPlan(data.plan || "free");

          setSubscriptionStatus(
            data.subscription_status || "inactive"
          );
        }
      } catch (error) {
        console.error("Settings load error:", error);
        setError("Unable to load your settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          workspace_name: workspaceName.trim() || "DocChatAI",
          language,
          auto_save_conversations: autoSave,
          ai_response_style: responseStyle,
          email_notifications: emailNotifications,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error("Settings save error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to save your settings."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <Link
        href="/dashboard"
        className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900"
        >
           ← Back to Dashboard
      </Link>
      {/* Header */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
          Workspace Settings
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
          Manage your DocChatAI workspace, preferences,
          and application settings.
        </p>
      </section>

      {/* General */}
      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            General
          </p>

          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Workspace preferences
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Configure your general DocChatAI preferences.
          </p>
        </div>

        <div className="space-y-7 p-7">
          {/* Workspace Name */}
          <div>
            <label className="text-sm font-medium text-slate-900">
              Workspace Name
            </label>

            <p className="mt-1 text-sm text-slate-500">
              The name displayed throughout your workspace.
            </p>

            <input
              value={workspaceName}
              onChange={(event) =>
                setWorkspaceName(event.target.value)
              }
              disabled={loading}
              className="
                mt-4
                w-full
                border
                border-slate-200
                bg-slate-50
                px-4
                py-3
                text-sm
                text-slate-900
                outline-none
                transition
                focus:border-blue-500
                focus:bg-white
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            />
          </div>

          {/* Language */}
          <div>
            <label className="text-sm font-medium text-slate-900">
              Language
            </label>

            <p className="mt-1 text-sm text-slate-500">
              Choose your preferred application language.
            </p>

            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value)
              }
              disabled={loading}
              className="
                mt-4
                w-full
                border
                border-slate-200
                bg-slate-50
                px-4
                py-3
                text-sm
                text-slate-900
                outline-none
                transition
                focus:border-blue-500
                focus:bg-white
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <option>English</option>
              <option>Spanish</option>
              <option>Italian</option>
              <option>French</option>
              <option>German</option>
            </select>
          </div>
        </div>
      </section>

      {/* AI Preferences */}
      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            AI Preferences
          </p>

          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Intelligence controls
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Control how DocChatAI processes and responds
            to your documents.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Auto Save */}
          <div className="flex items-center justify-between gap-8 p-7">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Auto Save Conversations
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Automatically save your document conversations.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoSave(!autoSave)}
              disabled={loading}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                autoSave
                  ? "bg-blue-600"
                  : "bg-slate-300"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              aria-label="Toggle auto save conversations"
              aria-pressed={autoSave}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                  autoSave ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Response Style */}
          <div className="p-7">
            <p className="text-sm font-medium text-slate-900">
              AI Response Style
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Choose the default response style for AI answers.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {["Balanced", "Concise", "Detailed"].map(
                (style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() =>
                      setResponseStyle(style)
                    }
                    disabled={loading}
                    className={`border px-4 py-3 text-sm font-medium transition ${
                      responseStyle === style
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {style}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Notifications
          </p>

          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Communication preferences
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Manage how DocChatAI communicates with you.
          </p>
        </div>

        <div className="flex items-center justify-between gap-8 p-7">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Email Notifications
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Receive important updates and account notifications.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setEmailNotifications(!emailNotifications)
            }
            disabled={loading}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              emailNotifications
                ? "bg-blue-600"
                : "bg-slate-300"
            } disabled:cursor-not-allowed disabled:opacity-60`}
            aria-label="Toggle email notifications"
            aria-pressed={emailNotifications}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                emailNotifications
                  ? "left-6"
                  : "left-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Account
          </p>

          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Subscription
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            View your current plan and subscription status.
          </p>
        </div>

        <div className="flex items-center justify-between gap-6 p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Current Plan
            </p>

            <p className="mt-2 text-2xl font-semibold capitalize text-slate-900">
              {loading ? "Loading..." : plan}
            </p>

            <p className="mt-1 text-sm capitalize text-slate-500">
              Subscription: {subscriptionStatus}
            </p>
          </div>

          <a
            href="/settings/billing"
            className="
              border
              border-blue-700
              bg-blue-600
              px-6
              py-3
              text-sm
              font-medium
              text-white
              transition
              hover:bg-blue-700
            "
          >
            View Plan & Billing
          </a>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-4 pb-10">
        {error && (
          <p className="max-w-md text-right text-sm text-red-600">
            {error}
          </p>
        )}

        {saved && !error && (
          <p className="text-sm text-emerald-600">
            Changes saved successfully.
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="
            border
            border-blue-700
            bg-blue-600
            px-8
            py-3
            text-sm
            font-medium
            text-white
            transition
            hover:bg-blue-700
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}