"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { hasFeature, type Plan } from "@/lib/plans";

type ResearchMode =
  | "deep"
  | "academic"
  | "business"
  | "competitive"
  | "market";

type ResearchDepth = "quick" | "standard" | "deep";

type Source = {
  title: string;
  url: string;
};

type ResearchResult = {
  answer: string;
  sources: Source[];
  queries: string[];
};

type DocumentItem = {
  id: string;
  name: string;
  file_name: string | null;
};

const MODES: {
  id: ResearchMode;
  label: string;
  description: string;
}[] = [
  {
    id: "deep",
    label: "Deep Research",
    description:
      "Broad research with detailed synthesis and evidence.",
  },
  {
    id: "academic",
    label: "Academic",
    description:
      "Research papers, evidence, methodology, and gaps.",
  },
  {
    id: "business",
    label: "Business",
    description:
      "Markets, companies, strategy, and opportunities.",
  },
  {
    id: "competitive",
    label: "Competitive",
    description:
      "Competitors, positioning, products, and trends.",
  },
  {
    id: "market",
    label: "Market Intelligence",
    description:
      "Market trends, opportunities, and emerging signals.",
  },
];

const SUGGESTIONS = [
  "What are the latest developments in this field?",
  "What are the biggest opportunities and risks?",
  "What are the strongest arguments on both sides?",
  "What research gaps still exist?",
];

export default function ResearchPage() {
  const supabase = createClient();

  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<ResearchMode>("deep");
  const [depth, setDepth] = useState<ResearchDepth>("deep");

  const [useDocuments, setUseDocuments] = useState(true);
  const [useWeb, setUseWeb] = useState(true);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const [researching, setResearching] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResearchResult | null>(null);

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error(
            "Profile loading error:",
            profileError
          );
        }

        const userPlan: Plan =
          data?.plan === "pro" ? "pro" : "free";

        setPlan(userPlan);

        if (hasFeature(userPlan, "research")) {
          await loadDocuments();
        }
      } catch (error) {
        console.error(
          "Research workspace error:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function loadDocuments() {
    setLoadingDocuments(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const {
        data,
        error: documentError,
      } = await supabase
        .from("documents")
        .select("id, name, file_name")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (documentError) {
        console.error(
          "Document loading error:",
          documentError
        );
        return;
      }

      setDocuments(
        (data ?? []) as DocumentItem[]
      );
    } catch (error) {
      console.error(
        "Document loading error:",
        error
      );
    } finally {
      setLoadingDocuments(false);
    }
  }

  const selectedMode = useMemo(() => {
    return (
      MODES.find((item) => item.id === mode) ??
      MODES[0]
    );
  }, [mode]);

  function toggleDocument(id: string) {
    setSelectedDocuments((current) => {
      if (current.includes(id)) {
        return current.filter(
          (documentId) => documentId !== id
        );
      }

      return [...current, id];
    });
  }

  function selectAllDocuments() {
    setSelectedDocuments(
      documents.map((document) => document.id)
    );
  }

  function clearDocuments() {
    setSelectedDocuments([]);
  }

  async function startResearch() {
    if (!question.trim()) {
      setError(
        "Enter a research question before starting."
      );
      return;
    }

    if (!useWeb && !useDocuments) {
      setError(
        "Select at least one research source."
      );
      return;
    }

    if (
      useDocuments &&
      selectedDocuments.length === 0 &&
      !useWeb
    ) {
      setError(
        "Select at least one document to research."
      );
      return;
    }

    setError("");
    setResult(null);
    setResearching(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      let response: Response;

      try {
        response = await fetch(
          `${API_URL}/api/research`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question: question.trim(),
              mode,
              depth,
              use_web: useWeb,
              use_documents: useDocuments,
              document_ids: selectedDocuments,
            }),
          }
        );
      } catch (networkError) {
        console.error(
          "Research network error:",
          networkError
        );

        throw new Error(
          `Unable to reach the DocChatAI API. Please verify the backend is running and the API URL is correct: ${API_URL}`
        );
      }

      let data: {
        answer?: string;
        sources?: Source[];
        queries?: string[];
        detail?: string;
      } = {};

      try {
        data = await response.json();
      } catch {
        // The server returned a non-JSON response.
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            `Research request failed with status ${response.status}.`
        );
      }

      setResult({
        answer: data.answer || "",
        sources: Array.isArray(data.sources)
          ? data.sources
          : [],
        queries: Array.isArray(data.queries)
          ? data.queries
          : [],
      });
    } catch (error) {
      console.error(
        "Research request error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Research failed. Please try again."
      );
    } finally {
      setResearching(false);
    }
  }

  function startNewResearch() {
    setQuestion("");
    setResult(null);
    setError("");
    setSelectedDocuments([]);
    setMode("deep");
    setDepth("deep");
    setUseWeb(true);
    setUseDocuments(true);
  }

  if (loading) {
    return (
      <div className="p-12 text-sm text-slate-400">
        Loading workspace...
      </div>
    );
  }

  if (!hasFeature(plan, "research")) {
    return (
      <div className="mx-auto max-w-4xl py-16">
        <div className="border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600">
            ◎
          </div>

          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
            Pro Intelligence
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Advanced Research
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">
            Combine your documents and research
            sources into deeper AI-powered reports,
            evidence-based analysis, and research
            insights.
          </p>

          <Link
            href="/settings/billing"
            className="mt-8 inline-block border border-blue-700 bg-blue-600 px-7 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <Link
        href="/dashboard"
        className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        ← Back to Dashboard
      </Link>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
          Business Intelligence
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Research
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
          Conduct deeper research across your
          knowledge and selected sources.
        </p>
      </section>

      <section className="border border-slate-200 bg-white p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <label className="text-sm font-medium text-slate-900">
              Research question
            </label>

            <p className="mt-1 text-xs text-slate-400">
              Ask a complex question and let
              DocChatAI investigate the evidence.
            </p>
          </div>

          <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {selectedMode.label}
          </div>
        </div>

        <textarea
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);

            if (error) {
              setError("");
            }
          }}
          placeholder="What would you like to research?"
          rows={6}
          className="mt-4 w-full resize-none border border-slate-200 bg-slate-50 p-5 text-sm leading-7 outline-none transition focus:border-blue-500 focus:bg-white"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuestion(suggestion);
                setError("");
              }}
              className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
            Research configuration
          </p>

          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Customize your investigation
          </h2>
        </div>

        <div className="mt-7 grid gap-8 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium text-slate-900">
              Research mode
            </p>

            <div className="space-y-2">
              {MODES.map((item) => {
                const selected = mode === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setMode(item.id)
                    }
                    className={`w-full border p-4 text-left transition ${
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {item.label}
                      </p>

                      {selected && (
                        <span className="text-xs font-semibold text-blue-600">
                          Selected
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-slate-900">
              Research depth
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: "quick",
                    label: "Quick",
                    description: "Fast overview",
                  },
                  {
                    id: "standard",
                    label: "Standard",
                    description: "Balanced analysis",
                  },
                  {
                    id: "deep",
                    label: "Deep",
                    description: "Detailed synthesis",
                  },
                ] as {
                  id: ResearchDepth;
                  label: string;
                  description: string;
                }[]
              ).map((item) => {
                const selected =
                  depth === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setDepth(item.id)
                    }
                    className={`border p-4 text-left transition ${
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {item.label}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium text-slate-900">
                Research sources
              </p>

              <button
                type="button"
                onClick={() => {
                  setUseWeb((current) => !current);
                  setError("");
                }}
                className={`flex w-full items-center justify-between border p-4 text-left transition ${
                  useWeb
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Web research
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Search external sources for current
                    information.
                  </p>
                </div>

                <span
                  className={`text-xs font-semibold ${
                    useWeb
                      ? "text-blue-600"
                      : "text-slate-400"
                  }`}
                >
                  {useWeb ? "ON" : "OFF"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUseDocuments(
                    (current) => !current
                  );
                  setError("");
                }}
                className={`flex w-full items-center justify-between border p-4 text-left transition ${
                  useDocuments
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    My documents
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Include information from your uploaded
                    documents.
                  </p>
                </div>

                <span
                  className={`text-xs font-semibold ${
                    useDocuments
                      ? "text-blue-600"
                      : "text-slate-400"
                  }`}
                >
                  {useDocuments ? "ON" : "OFF"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {useDocuments && (
        <section className="border border-slate-200 bg-white p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                Knowledge base
              </p>

              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Select documents
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Choose which documents should inform
                your research.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllDocuments}
                disabled={documents.length === 0}
                className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Select All
              </button>

              <button
                type="button"
                onClick={clearDocuments}
                disabled={
                  selectedDocuments.length === 0
                }
                className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {loadingDocuments ? (
            <div className="mt-6 border border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="mt-6 border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No documents available
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Upload a document first if you want
                Research to use your private knowledge
                base.
              </p>

              <Link
                href="/upload"
                className="mt-5 inline-block border border-blue-600 bg-blue-600 px-5 py-2.5 text-xs font-medium text-white transition hover:bg-blue-700"
              >
                Upload Document
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              {documents.map((document) => {
                const selected =
                  selectedDocuments.includes(
                    document.id
                  );

                return (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() =>
                      toggleDocument(document.id)
                    }
                    className={`flex w-full items-center justify-between border p-4 text-left transition ${
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {document.name ||
                          document.file_name ||
                          "Untitled document"}
                      </p>

                      {document.file_name &&
                        document.file_name !==
                          document.name && (
                          <p className="mt-1 truncate text-xs text-slate-400">
                            {document.file_name}
                          </p>
                        )}
                    </div>

                    <span
                      className={`ml-4 shrink-0 text-xs font-semibold ${
                        selected
                          ? "text-blue-600"
                          : "text-slate-400"
                      }`}
                    >
                      {selected
                        ? "Selected"
                        : "Select"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedDocuments.length > 0 && (
            <p className="mt-4 text-xs text-slate-400">
              {selectedDocuments.length} document
              {selectedDocuments.length === 1
                ? ""
                : "s"} selected
            </p>
          )}
        </section>
      )}

      {error && (
        <section className="border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-700">
            Research error
          </p>

          <p className="mt-1 text-sm leading-6 text-red-600">
            {error}
          </p>
        </section>
      )}

      {!result && (
        <section className="border border-slate-200 bg-white p-8">
          <div className="flex flex-col items-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
              Ready to investigate
            </p>

            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              Start your research
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              DocChatAI will analyze your selected
              sources and produce a structured research
              response.
            </p>

            <button
              type="button"
              onClick={startResearch}
              disabled={researching}
              className="mt-7 min-w-48 border border-blue-700 bg-blue-600 px-7 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {researching
                ? "Researching..."
                : "Start Research"}
            </button>
          </div>
        </section>
      )}

      {researching && (
        <section className="border border-blue-200 bg-blue-50 p-8">
          <div className="flex items-center gap-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />

            <div>
              <p className="text-sm font-medium text-slate-900">
                Research in progress
              </p>

              <p className="mt-1 text-xs text-slate-500">
                DocChatAI is investigating the selected
                sources. This may take a moment.
              </p>
            </div>
          </div>
        </section>
      )}

      {result && !researching && (
        <section className="space-y-6">
          <div className="flex flex-col justify-between gap-4 border border-slate-200 bg-white p-8 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                Research complete
              </p>

              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                Research findings
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {selectedMode.label} ·{" "}
                {depth.charAt(0).toUpperCase() +
                  depth.slice(1)}{" "}
                depth
              </p>
            </div>

            <button
              type="button"
              onClick={startNewResearch}
              className="border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
            >
              New Research
            </button>
          </div>

          <div className="border border-slate-200 bg-white p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
              Answer
            </p>

            <div className="mt-6 whitespace-pre-wrap text-sm leading-8 text-slate-700">
              {result.answer ||
                "No research answer was returned."}
            </div>
          </div>

          {result.sources.length > 0 && (
            <div className="border border-slate-200 bg-white p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                Sources
              </p>

              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                Research sources
              </h3>

              <div className="mt-6 space-y-3">
                {result.sources.map(
                  (source, index) => (
                    <a
                      key={`${source.url}-${index}`}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-white"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {source.title ||
                          "Research source"}
                      </p>

                      <p className="mt-1 break-all text-xs text-slate-400">
                        {source.url}
                      </p>
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          {result.queries.length > 0 && (
            <div className="border border-slate-200 bg-white p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                Search strategy
              </p>

              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                Research queries
              </h3>

              <div className="mt-6 space-y-2">
                {result.queries.map(
                  (query, index) => (
                    <div
                      key={`${query}-${index}`}
                      className="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
                    >
                      {query}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}