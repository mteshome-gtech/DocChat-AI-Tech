"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [documents, setDocuments] = useState(0);
  const [aiQueries, setAiQueries] = useState(0);
  const [storage, setStorage] = useState("0 GB");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (mounted) {
            router.replace("/auth/signin");
          }
          return;
        }

        const { data: documentData, error: documentError } =
          await supabase
            .from("documents")
            .select("id, file_size")
            .eq("user_id", user.id);

        if (documentError) {
          console.error("Documents error:", documentError);
          return;
        }

        if (!mounted) return;

        setDocuments(documentData?.length || 0);

        const totalBytes =
          documentData?.reduce(
            (total, document) =>
              total + (document.file_size || 0),
            0
          ) || 0;

        setStorage(formatStorage(totalBytes));

        const { count, error: queryError } = await supabase
          .from("messages")
          .select("id, conversations!inner(user_id)", {
            count: "exact",
            head: true,
          })
          .eq("role", "user")
          .eq("conversations.user_id", user.id);

        if (queryError) {
          console.error("AI queries error:", queryError);
          return;
        }

        if (!mounted) return;

        setAiQueries(count || 0);
      } catch (error) {
        console.error("Dashboard error:", error);

        if (mounted) {
          router.replace("/auth/signin");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        router.replace("/auth/signin");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-500">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="border border-slate-200 bg-white p-10">
        <p className="text-sm font-medium uppercase tracking-widest text-blue-600">
          AI Document Intelligence
        </p>

        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-slate-900">
          Understand your documents
          <br />
          with AI.
        </h1>

        <p className="mt-5 max-w-xl text-lg text-slate-500">
          Upload PDFs, analyze information, ask questions, and translate
          documents using advanced AI models.
        </p>

        <button
          onClick={() => {
            router.push("/documents/upload");
          }}
          className="mt-8 border border-blue-700 bg-blue-600 px-8 py-4 font-medium text-white transition hover:bg-blue-700"
        >
          Upload Document
        </button>
      </section>

      <section className="grid grid-cols-3 gap-6">
        <DashboardCard
          title="Documents"
          value={documents.toString()}
          description="Files analyzed"
        />

        <DashboardCard
          title="AI Queries"
          value={aiQueries.toString()}
          description="Questions answered"
        />

        <DashboardCard
          title="Storage"
          value={storage}
          description="Available space"
        />
      </section>

      <section className="border border-slate-200 bg-white p-8">
        <h2 className="text-xl font-semibold text-slate-900">
          Recent Documents
        </h2>

        <div className="mt-6 border border-dashed border-slate-300 p-10 text-center">
          <p className="text-slate-500">
            {documents === 0
              ? "No documents uploaded yet."
              : `${documents} document${
                  documents === 1 ? "" : "s"
                } uploaded.`}
          </p>
        </div>
      </section>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-6">
      <p className="text-sm text-slate-500">{title}</p>

      <h3 className="mt-3 text-3xl font-semibold text-slate-900">
        {value}
      </h3>

      <p className="mt-2 text-sm text-slate-400">
        {description}
      </p>
    </div>
  );
}

function formatStorage(bytes: number) {
  if (bytes === 0) {
    return "0 GB";
  }

  const gigabytes = bytes / 1024 / 1024 / 1024;

  if (gigabytes < 0.01) {
    const megabytes = bytes / 1024 / 1024;

    return `${megabytes.toFixed(2)} MB`;
  }

  return `${gigabytes.toFixed(2)} GB`;
}