"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const supabase = createClient();

  const [documents, setDocuments] = useState(0);
  const [aiQueries, setAiQueries] = useState(0);
  const [storage, setStorage] = useState("0 GB");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return;
        }

        // Get user's documents
        const { data: documentData, error: documentError } =
          await supabase
            .from("documents")
            .select("id, file_size")
            .eq("user_id", user.id);

        if (documentError) {
          console.error(
            "Documents error:",
            documentError
          );
          return;
        }

        // Documents count
        setDocuments(documentData?.length || 0);

        // Total storage used
        const totalBytes =
          documentData?.reduce(
            (total, document) =>
              total + (document.file_size || 0),
            0
          ) || 0;

        setStorage(formatStorage(totalBytes));

        // Get user's AI queries
        const { count, error: queryError } =
          await supabase
            .from("messages")
            .select(
              "id, conversations!inner(user_id)",
              {
                count: "exact",
                head: true,
              }
            )
            .eq("role", "user")
            .eq("conversations.user_id", user.id);

        if (queryError) {
          console.error(
            "AI queries error:",
            queryError
          );
          return;
        }

        setAiQueries(count || 0);
      } catch (error) {
        console.error(
          "Dashboard error:",
          error
        );
      }
    }

    loadDashboardData();
  }, []);

  return (
    <div className="space-y-10">

      {/* Hero */}
      <section className="
        border
        border-slate-200
        bg-white
        p-10
      ">

        <p className="
          text-sm
          uppercase
          tracking-widest
          text-blue-600
          font-medium
        ">

          AI Document Intelligence

        </p>

        <h1 className="
          mt-4
          text-5xl
          font-semibold
          tracking-tight
          text-slate-900
        ">

          Understand your documents
          <br/>
          with AI.

        </h1>

        <p className="
          mt-5
          max-w-xl
          text-lg
          text-slate-500
        ">

          Upload PDFs, analyze information,
          ask questions, and translate documents
          using advanced AI models.

        </p>

        <button
          onClick={() => {
            window.location.href =
              "/documents/upload";
          }}
          className="
          mt-8
          bg-blue-600
          px-8
          py-4
          text-white
          font-medium
          border
          border-blue-700
          hover:bg-blue-700
          transition
          "
        >
          Upload Document
        </button>

      </section>


      {/* Dashboard Grid */}
      <section className="
        grid
        grid-cols-3
        gap-6
      ">

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


      {/* Recent Documents */}
      <section
        className="
        border
        border-slate-200
        bg-white
        p-8
        "
      >

        <h2
          className="
          text-xl
          font-semibold
          text-slate-900
          "
        >
          Recent Documents
        </h2>

        <div
          className="
          mt-6
          border
          border-dashed
          border-slate-300
          p-10
          text-center
          "
        >

          <p className="
            text-slate-500
          ">

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
  description

}: {

  title: string;
  value: string;
  description: string;

}) {

  return (

    <div
      className="
      border
      border-slate-200
      bg-white
      p-6
      "
    >

      <p className="
        text-sm
        text-slate-500
      ">

        {title}

      </p>


      <h3
        className="
        mt-3
        text-3xl
        font-semibold
        text-slate-900
        "
      >

        {value}

      </h3>


      <p
        className="
        mt-2
        text-sm
        text-slate-400
        "
      >

        {description}

      </p>

    </div>

  );
}


function formatStorage(bytes: number) {

  if (bytes === 0) {
    return "0 GB";
  }

  const gigabytes =
    bytes / 1024 / 1024 / 1024;

  if (gigabytes < 0.01) {
    const megabytes =
      bytes / 1024 / 1024;

    return `${megabytes.toFixed(2)} MB`;
  }

  return `${gigabytes.toFixed(2)} GB`;
}