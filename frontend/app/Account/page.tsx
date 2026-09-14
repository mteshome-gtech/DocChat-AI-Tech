
"use client";

export default function Account() {
  return (
    <div className="space-y-10">

      {/* Header */}
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-600 font-medium">
          Account Management
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Account
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-slate-500">
          Manage your personal information, subscription, and account
          preferences.
        </p>
      </section>

      {/* Profile */}
      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Profile
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Update the information associated with your account.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 p-8">

          <div>
            <label className="text-sm font-medium text-slate-700">
              First Name
            </label>

            <input
              type="text"
              defaultValue=""
              placeholder="First name"
              className="mt-2 w-full border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Last Name
            </label>

            <input
              type="text"
              defaultValue=""
              placeholder="Last name"
              className="mt-2 w-full border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
            />
          </div>

          <div className="col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Email Address
            </label>

            <input
              type="email"
              defaultValue=""
              placeholder="your@email.com"
              className="mt-2 w-full border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
            />
          </div>

        </div>

        <div className="border-t border-slate-200 p-8">

          <button className="border border-blue-700 bg-blue-600 px-7 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
            Save Profile
          </button>

        </div>

      </section>

      {/* Subscription */}
      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 p-8">

          <p className="text-sm uppercase tracking-widest text-blue-600 font-medium">
            Subscription
          </p>

          <h2 className="mt-3 text-xl font-semibold text-slate-900">
            Free Plan
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Your current DocChatAI subscription.
          </p>

        </div>

        <div className="grid grid-cols-3 gap-6 p-8">

          <AccountStat
            title="Documents"
            value="0 / 10"
            description="Documents stored"
          />

          <AccountStat
            title="AI Queries"
            value="0"
            description="Queries this month"
          />

          <AccountStat
            title="Storage"
            value="0 GB"
            description="Storage used"
          />

        </div>

        <div className="border-t border-slate-200 p-8">

          <button className="border border-blue-700 bg-blue-600 px-7 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
            Upgrade Plan
          </button>

        </div>

      </section>

      {/* Security */}
      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 p-8">

          <h2 className="text-xl font-semibold text-slate-900">
            Security
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Manage your account security.
          </p>

        </div>

        <div className="flex items-center justify-between p-8">

          <div>
            <h3 className="text-sm font-medium text-slate-900">
              Password
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Change your account password.
            </p>
          </div>

          <button className="border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-600">
            Change Password
          </button>

        </div>

      </section>

      {/* Danger Zone */}
      <section className="border border-red-200 bg-white">

        <div className="p-8">

          <p className="text-sm uppercase tracking-widest text-red-600 font-medium">
            Danger Zone
          </p>

          <h2 className="mt-3 text-xl font-semibold text-slate-900">
            Delete Account
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Permanently delete your DocChatAI account, documents, conversations,
            and associated data.
          </p>

          <button className="mt-6 border border-red-600 px-6 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50">
            Delete Account
          </button>

        </div>

      </section>

    </div>
  );
}

function AccountStat({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="border border-slate-200 p-6">

      <p className="text-sm text-slate-500">
        {title}
      </p>

      <h3 className="mt-3 text-2xl font-semibold text-slate-900">
        {value}
      </h3>

      <p className="mt-2 text-sm text-slate-400">
        {description}
      </p>

    </div>
  );
}