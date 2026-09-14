
"use client";

import { useState } from "react";

export default function Settings() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  return (
    <div className="space-y-10">

      {/* Header */}
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-600 font-medium">
          Workspace Settings
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-slate-500">
          Manage your DocChatAI workspace, preferences, and application
          settings.
        </p>
      </section>

      {/* General Settings */}
      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            General
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Configure your general DocChatAI preferences.
          </p>
        </div>

        <div className="divide-y divide-slate-200">

          <SettingRow
            title="Workspace Name"
            description="The name displayed throughout your workspace."
          >
            <input
              type="text"
              defaultValue="DocChatAI Workspace"
              className="w-72 border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </SettingRow>

          <SettingRow
            title="Language"
            description="Choose your preferred application language."
          >
            <select className="w-72 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500">
              <option>English</option>
              <option>Spanish</option>
              <option>Italian</option>
              <option>French</option>
              <option>German</option>
            </select>
          </SettingRow>

        </div>

      </section>

      {/* AI Settings */}
      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            AI Preferences
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Control how DocChatAI processes and responds to your documents.
          </p>
        </div>

        <div className="divide-y divide-slate-200">

          <ToggleRow
            title="Auto Save Conversations"
            description="Automatically save your document conversations."
            enabled={autoSave}
            onChange={setAutoSave}
          />

          <SettingRow
            title="AI Response Style"
            description="Choose the default response style for AI answers."
          >
            <select className="w-72 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500">
              <option>Balanced</option>
              <option>Concise</option>
              <option>Detailed</option>
            </select>
          </SettingRow>

        </div>

      </section>

      {/* Notifications */}
      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Notifications
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Manage how DocChatAI communicates with you.
          </p>
        </div>

        <div className="p-8">

          <ToggleRow
            title="Email Notifications"
            description="Receive important updates and account notifications."
            enabled={emailNotifications}
            onChange={setEmailNotifications}
          />

        </div>

      </section>

      {/* Save */}
      <div className="flex justify-end">

        <button className="border border-blue-700 bg-blue-600 px-8 py-4 text-sm font-medium text-white transition hover:bg-blue-700">
          Save Changes
        </button>

      </div>

    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-8 p-8">

      <div>
        <h3 className="text-sm font-medium text-slate-900">
          {title}
        </h3>

        <p className="mt-2 max-w-xl text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div>
        {children}
      </div>

    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-8 p-8">

      <div>
        <h3 className="text-sm font-medium text-slate-900">
          {title}
        </h3>

        <p className="mt-2 max-w-xl text-sm text-slate-500">
          {description}
        </p>
      </div>

      <button
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 border transition ${
          enabled
            ? "border-blue-700 bg-blue-600"
            : "border-slate-300 bg-slate-200"
        }`}
        aria-label={`Toggle ${title}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 bg-white transition ${
            enabled ? "left-6" : "left-0.5"
          }`}
        />
      </button>

    </div>
  );
}
