"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasFeature, type Plan } from "@/lib/plans";

type DocumentItem = {
  id: string;
  name: string;
  file_name: string | null;
};

type CompareType = "full" | "changes" | "similarities";
type CompareDepth = "quick" | "standard" | "deep";

type CompareResult = {
  summary: string;
  added: string[];
  removed: string[];
  modified: string[];
  similarities: string[];
};

export default function ComparePage() {
  const supabase = createClient();

  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const [documentA, setDocumentA] = useState("");
  const [documentB, setDocumentB] = useState("");

  const [compareType, setCompareType] =
    useState<CompareType>("full");

  const [depth, setDepth] =
    useState<CompareDepth>("standard");

  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] =
    useState<CompareResult | null>(null);

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

        if (hasFeature(userPlan, "compare")) {
          await loadDocuments();
        }
      } catch (error) {
        console.error(
          "Compare workspace error:",
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

      const { data, error: documentError } =
        await supabase
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

        setError(
          "Unable to load your documents."
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

      setError(
        "Unable to load your documents."
      );
    } finally {
      setLoadingDocuments(false);
    }
  }

  const selectedA = useMemo(
    () =>
      documents.find(
        (document) =>
          document.id === documentA
      ),
    [documents, documentA]
  );

  const selectedB = useMemo(
    () =>
      documents.find(
        (document) =>
          document.id === documentB
      ),
    [documents, documentB]
  );

  function handleDocumentAChange(
    value: string
  ) {
    setDocumentA(value);
    setResult(null);
    setError("");

    if (value === documentB) {
      setDocumentB("");
    }
  }

  function handleDocumentBChange(
    value: string
  ) {
    setDocumentB(value);
    setResult(null);
    setError("");

    if (value === documentA) {
      setDocumentA("");
    }
  }

  function resetComparison() {
    setDocumentA("");
    setDocumentB("");
    setCompareType("full");
    setDepth("standard");
    setResult(null);
    setError("");
  }

  async function compareDocuments() {
    if (!documentA || !documentB) {
      setError(
        "Select two documents before comparing."
      );
      return;
    }

    if (documentA === documentB) {
      setError(
        "Document A and Document B must be different."
      );
      return;
    }

    setError("");
    setResult(null);
    setComparing(true);

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
        "http://127.0.0.1:8000/api/compare",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            document_a_id: documentA,
            document_b_id: documentB,
            compare_type: compareType,
            depth,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Comparison failed. Please try again."
        );
      }

      setResult({
        summary: data.summary || "",
        added: Array.isArray(data.added)
          ? data.added
          : [],
        removed: Array.isArray(data.removed)
          ? data.removed
          : [],
        modified: Array.isArray(data.modified)
          ? data.modified
          : [],
        similarities: Array.isArray(
          data.similarities
        )
          ? data.similarities
          : [],
      });
    } catch (error) {
      console.error(
        "Comparison request error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Comparison failed. Please try again."
      );
    } finally {
      setComparing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-sm text-slate-400">
        Loading workspace...
      </div>
    );
  }

  if (!hasFeature(plan, "compare")) {
    return (
      <div className="mx-auto max-w-4xl py-16">
        <div className="border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600">
            ⇄
          </div>

          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
            Pro Feature
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Compare documents side by side.
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">
            Identify added, removed, and modified
            content across two documents.
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
          AI Tools
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Compare
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
          Discover meaningful changes, similarities,
          and differences between two documents.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <DocumentPicker
          label="Document A"
          description="Select the original or first version."
          value={documentA}
          documents={documents}
          loading={loadingDocuments}
          excludedId={documentB}
          onChange={handleDocumentAChange}
        />

        <DocumentPicker
          label="Document B"
          description="Select the document you want to compare."
          value={documentB}
          documents={documents}
          loading={loadingDocuments}
          excludedId={documentA}
          onChange={handleDocumentBChange}
        />
      </section>

      {documents.length === 0 &&
        !loadingDocuments && (
          <section className="border border-slate-200 bg-white p-8">
            <p className="text-sm font-medium text-slate-900">
              No documents available
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Upload at least two documents before
              using Compare.
            </p>

            <Link
              href="/documents"
              className="mt-4 inline-block text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Open Documents →
            </Link>
          </section>
        )}

      <section className="border border-slate-200 bg-white p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
            Comparison configuration
          </p>

          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Customize your comparison
          </h2>
        </div>

        <div className="mt-7 grid gap-8 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium text-slate-900">
              Comparison type
            </p>

            <div className="space-y-2">
              <CompareOption
                title="Full Comparison"
                description="Analyze changes, similarities, and modified content."
                selected={
                  compareType === "full"
                }
                onClick={() =>
                  setCompareType("full")
                }
              />

              <CompareOption
                title="Key Changes"
                description="Focus on the most important additions, removals, and modifications."
                selected={
                  compareType === "changes"
                }
                onClick={() =>
                  setCompareType("changes")
                }
              />

              <CompareOption
                title="Similarities"
                description="Identify the strongest areas of overlap between both documents."
                selected={
                  compareType === "similarities"
                }
                onClick={() =>
                  setCompareType("similarities")
                }
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-slate-900">
              Comparison depth
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  "quick",
                  "standard",
                  "deep",
                ] as CompareDepth[]
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

            <div className="mt-7 border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Selected documents
              </p>

              <div className="mt-4 space-y-3">
                <SelectedDocument
                  label="A"
                  document={selectedA}
                />

                <SelectedDocument
                  label="B"
                  document={selectedB}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

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
              Ready to compare
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              {selectedA?.name ||
                "Document A not selected"}
              {"  ↔  "}
              {selectedB?.name ||
                "Document B not selected"}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetComparison}
              className="border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={compareDocuments}
              disabled={
                comparing ||
                !documentA ||
                !documentB
              }
              className="border border-blue-700 bg-blue-600 px-8 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {comparing
                ? "Comparing..."
                : "Compare Documents"}
            </button>
          </div>
        </div>
      </section>

      {comparing && (
        <section className="border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600">
              ⇄
            </div>

            <div>
              <p className="text-sm font-medium text-slate-900">
                Comparison in progress
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Reading both documents and identifying
                meaningful differences...
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
                  Comparison Report
                </p>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  Comparison Results
                </h2>

                <p className="mt-2 text-xs text-slate-400">
                  {selectedA?.name || "Document A"}
                  {"  ↔  "}
                  {selectedB?.name || "Document B"}
                  {" · "}
                  {depth} depth
                </p>
              </div>

              <button
                type="button"
                onClick={resetComparison}
                className="border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
              >
                New Comparison
              </button>
            </div>
          </div>

          <div className="p-8">
            <ResultSection
              title="Summary"
              items={
                result.summary
                  ? [result.summary]
                  : []
              }
              emptyText="No summary was returned."
            />

            <ResultSection
              title="Added"
              items={result.added}
              emptyText="No significant additions identified."
            />

            <ResultSection
              title="Removed"
              items={result.removed}
              emptyText="No significant removals identified."
            />

            <ResultSection
              title="Modified"
              items={result.modified}
              emptyText="No significant modifications identified."
            />

            <ResultSection
              title="Similarities"
              items={result.similarities}
              emptyText="No significant similarities identified."
            />
          </div>
        </section>
      )}
    </div>
  );
}

function DocumentPicker({
  label,
  description,
  value,
  documents,
  loading,
  excludedId,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  documents: DocumentItem[];
  loading: boolean;
  excludedId: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="border border-slate-200 bg-white p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {label}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-600">
          {label === "Document A"
            ? "A"
            : "B"}
        </div>
      </div>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={
          loading ||
          documents.length === 0
        }
        className="mt-5 w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">
          {loading
            ? "Loading documents..."
            : "Select a document"}
        </option>

        {documents.map((document) => (
          <option
            key={document.id}
            value={document.id}
            disabled={
              document.id === excludedId
            }
          >
            {document.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CompareOption({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border p-4 text-left transition ${
        selected
          ? "border-blue-500 bg-blue-50"
          : "border-slate-200 bg-white hover:border-blue-300"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-900">
          {title}
        </p>

        {selected && (
          <span className="text-xs font-semibold text-blue-600">
            Selected
          </span>
        )}
      </div>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </button>
  );
}

function SelectedDocument({
  label,
  document,
}: {
  label: string;
  document?: DocumentItem;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-slate-200 bg-white text-[10px] font-semibold text-slate-500">
        {label}
      </div>

      <p className="truncate text-xs text-slate-600">
        {document?.name ||
          "No document selected"}
      </p>
    </div>
  );
}

function ResultSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="border-b border-slate-100 py-7 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          {title}
        </p>

        <span className="text-xs text-slate-400">
          {items.length}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-sm leading-6 text-slate-700">
                {item}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400">
          {emptyText}
        </p>
      )}
    </div>
  );
}