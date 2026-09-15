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
    description: "Broad research with detailed synthesis and evidence.",
  },
  {
    id: "academic",
    label: "Academic",
    description: "Research papers, evidence, methodology, and gaps.",
  },
  {
    id: "business",
    label: "Business",
    description: "Markets, companies, strategy, and opportunities.",
  },
  {
    id: "competitive",
    label: "Competitive",
    description: "Competitors, positioning, products, and trends.",
  },
  {
    id: "market",
    label: "Market Intelligence",
    description: "Market trends, opportunities, and emerging signals.",
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

        const { data } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        const userPlan: Plan =
          data?.plan === "pro"
            ? "pro"
            : "free";

        setPlan(userPlan);

        if (hasFeature(userPlan, "research")) {
          await loadDocuments();
        }
      } catch (error) {
        console.error("Research workspace error:", error);
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

      const { data, error: documentError } = await supabase
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

      setDocuments((data ?? []) as DocumentItem[]);
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

      const response = await fetch(
        "http://127.0.0.1:8000/api/research",
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Research failed. Please try again."
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
            Business Intelligence
          </p>  

          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Advanced Research
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">
            Combine your documents, shared knowledge,
            and research sources into deeper
            AI-powered reports.
          </p>

          <Link
            href="/settings/billing"
            className="mt-8 inline-block border border-blue-700 bg-blue-600 px-7 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Upgrade to Business
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
          organization's knowledge and selected
          sources.
        </p>
      </section>

      <section className="border border-slate-200 bg-white p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <label className="text-sm font-medium text-slate-900">
              Research question
            </label>

            <p className="mt-1 text-xs text-slate-400">
              Ask a complex question and let DocChatAI
              investigate the evidence.
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

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium text-slate-900">
              Research mode
            </p>

            <div className="space-y-2">
              {MODES.map((item) => {
                const selected =
                  mode === item.id;

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

          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-900">
                Research depth
              </p>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    "quick",
                    "standard",
                    "deep",
                  ] as ResearchDepth[]
                ).map((item) => {
                  const selected =
                    depth === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        setDepth(item)
                      }
                      className={`border px-3 py-3 text-xs font-medium capitalize transition ${
                        selected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-slate-900">
                Research sources
              </p>

              <div className="space-y-2">
                <SourceCard
                  title="My Documents"
                  description="Use your private document library."
                  selected={useDocuments}
                  onClick={() =>
                    setUseDocuments(
                      (current) => !current
                    )
                  }
                />

                <SourceCard
                  title="Research Sources"
                  description="Search current external information."
                  selected={useWeb}
                  onClick={() =>
                    setUseWeb(
                      (current) => !current
                    )
                  }
                />

                <SourceCard
                  title="Shared Knowledge"
                  description="Use organizational knowledge when available."
                  selected={false}
                  disabled
                  onClick={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {useDocuments && (
        <section className="border border-slate-200 bg-white p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                Knowledge base
              </p>

              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Select documents
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Choose which private documents
                should be included in the research.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllDocuments}
                disabled={
                  documents.length === 0
                }
                className="border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select all
              </button>

              <button
                type="button"
                onClick={clearDocuments}
                disabled={
                  selectedDocuments.length === 0
                }
                className="border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-6 border border-slate-200">
            {loadingDocuments ? (
              <div className="p-6 text-sm text-slate-400">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No documents found
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Upload documents before using
                  private document research.
                </p>

                <Link
                  href="/documents"
                  className="mt-4 inline-block text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Open Documents →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
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
                        toggleDocument(
                          document.id
                        )
                      }
                      className={`flex w-full items-center gap-4 p-4 text-left transition ${
                        selected
                          ? "bg-blue-50"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center border text-xs ${
                          selected
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {selected ? "✓" : "DOC"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {document.name}
                        </p>

                        {document.file_name && (
                          <p className="mt-1 truncate text-xs text-slate-400">
                            {document.file_name}
                          </p>
                        )}
                      </div>

                      <div
                        className={`h-4 w-4 border ${
                          selected
                            ? "border-blue-600 bg-blue-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {selected && (
                          <div className="flex h-full items-center justify-center text-[9px] text-white">
                            ✓
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-slate-400">
            {selectedDocuments.length} document
            {selectedDocuments.length === 1
              ? ""
              : "s"} selected
          </div>
        </section>
      )}

      {error && (
        <section className="border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </section>
      )}

      <section className="border border-slate-200 bg-white p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Ready to research
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              {selectedMode.label}
              {" · "}
              {depth} depth
              {" · "}
              {useWeb && useDocuments
                ? "Web + private documents"
                : useWeb
                  ? "Web research"
                  : "Private documents"}
            </p>
          </div>

          <button
            type="button"
            onClick={startResearch}
            disabled={researching}
            className="border border-blue-700 bg-blue-600 px-8 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {researching
              ? "Researching..."
              : "Start Research"}
          </button>
        </div>
      </section>

      {researching && (
        <section className="border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600">
              ◎
            </div>

            <div>
              <p className="text-sm font-medium text-slate-900">
                Research in progress
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Searching, evaluating, and
                synthesizing information...
              </p>
            </div>
          </div>

          <div className="mt-6 h-1 w-full overflow-hidden bg-slate-100">
            <div className="h-full w-2/3 animate-pulse bg-blue-600" />
          </div>
        </section>
      )}

      {result && (
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                  Intelligence Report
                </p>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  Research Results
                </h2>

                <p className="mt-2 text-xs text-slate-400">
                  {selectedMode.label}
                  {" · "}
                  {depth} depth
                </p>
              </div>

              <button
                type="button"
                onClick={startNewResearch}
                className="border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
              >
                New Research
              </button>
            </div>
          </div>

          <div className="p-8">
            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {result.answer}
            </div>

            {result.queries.length > 0 && (
              <div className="mt-10 border-t border-slate-100 pt-7">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Search queries
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {result.queries.map(
                    (query, index) => (
                      <span
                        key={`${query}-${index}`}
                        className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                      >
                        {query}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {result.sources.length > 0 && (
              <div className="mt-10 border-t border-slate-100 pt-7">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Research Sources
                  </p>

                  <span className="text-xs text-slate-400">
                    {result.sources.length} source
                    {result.sources.length === 1
                      ? ""
                      : "s"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {result.sources.map(
                    (source, index) => (
                      <a
                        key={`${source.url}-${index}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/30"
                      >
                        <div className="flex gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-600">
                            {String(
                              index + 1
                            ).padStart(2, "0")}
                          </div>

                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-medium text-slate-800">
                              {source.title}
                            </p>

                            <p className="mt-2 truncate text-xs text-slate-400">
                              {source.url}
                            </p>
                          </div>
                        </div>
                      </a>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function SourceCard({
  title,
  description,
  selected,
  disabled = false,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full border p-5 text-left transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
          : selected
            ? "border-blue-500 bg-blue-50"
            : "border-slate-200 bg-white hover:border-blue-300"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-900">
          {title}
        </p>

        {disabled ? (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Coming soon
          </span>
        ) : (
          <span
            className={`flex h-5 w-5 items-center justify-center border text-[10px] ${
              selected
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white text-transparent"
            }`}
          >
            ✓
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </button>
  );
}