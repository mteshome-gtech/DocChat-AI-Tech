"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  FileText,
  Trash2,
  Eye,
  ArrowLeft,
  Upload,
  Sparkles,
  X,
  Clock3,
  HardDrive,
  FileCheck2,
  ChevronRight,
} from "lucide-react";

type Document = {
  id: string;
  name: string;
  created_at: string;
  size?: number;
  mime_type?: string;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] =
    useState<Document | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const supabase = createClient();

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setDocuments([]);
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading documents:", error);
        return;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(document: Document) {
    try {
      setPreviewLoading(true);
      setSelectedDocument(document);
      setPreviewText("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("You must be logged in to preview a document.");
      }

      const response = await fetch(
        `${API_URL}/api/upload/${document.id}/preview`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to load document preview.");
      }

      const data = await response.json();

      setPreviewText(data.text || data.preview || "");
    } catch (error) {
      console.error("Preview error:", error);

      setPreviewText(
        error instanceof Error
          ? error.message
          : "Failed to load document preview."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDelete(documentId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this document?"
    );

    if (!confirmed) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("You must be logged in to delete a document.");
      }

      const response = await fetch(
        `${API_URL}/api/upload/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete document.");
      }

      setDocuments((current) =>
        current.filter((document) => document.id !== documentId)
      );

      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
        setPreviewText("");
      }
    } catch (error) {
      console.error("Delete error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete document."
      );
    }
  }

  function formatFileSize(size?: number) {
    if (!size) return "Unknown size";

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatFileType(mimeType?: string) {
    if (!mimeType) return "DOCUMENT";

    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("word")) return "DOCX";
    if (mimeType.includes("text")) return "TXT";
    if (mimeType.includes("presentation")) return "PPTX";
    if (mimeType.includes("spreadsheet")) return "XLSX";

    return mimeType.split("/").pop()?.toUpperCase() || "DOCUMENT";
  }

  function closePreview() {
    setSelectedDocument(null);
    setPreviewText("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070812] text-white">
      {/* Ambient luxury background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[140px]" />
        <div className="absolute right-[-180px] top-[15%] h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[160px]" />
        <div className="absolute bottom-[-250px] left-[25%] h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[150px]" />

        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        {/* Header */}
        <header className="mb-10">
          <Link
            href="/dashboard"
            className="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/45 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Dashboard
          </Link>

          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60 backdrop-blur-xl">
                <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                Your Knowledge Library
              </div>

              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Documents
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-7 text-white/45">
                Your private collection of intelligent documents, ready to
                analyze, explore, compare, and chat with.
              </p>
            </div>

            <Link
              href="/upload"
              className="group inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white px-5 py-3.5 text-sm font-semibold text-[#080910] shadow-[0_12px_40px_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-0.5 hover:bg-white/90"
            >
              <Upload className="h-4 w-4" />
              Upload Document
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </header>

        {/* Stats */}
        {!loading && documents.length > 0 && (
          <section className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl transition hover:border-white/[0.14] hover:bg-white/[0.05]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/15 bg-indigo-400/10">
                <FileCheck2 className="h-5 w-5 text-indigo-300" />
              </div>

              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">
                Documents
              </p>

              <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
                {documents.length}
              </p>
            </div>

            <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl transition hover:border-white/[0.14] hover:bg-white/[0.05]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/10">
                <HardDrive className="h-5 w-5 text-violet-300" />
              </div>

              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">
                Library Size
              </p>

              <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
                {formatFileSize(
                  documents.reduce(
                    (total, document) => total + (document.size || 0),
                    0
                  )
                )}
              </p>
            </div>

            <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl transition hover:border-white/[0.14] hover:bg-white/[0.05]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/10">
                <Clock3 className="h-5 w-5 text-blue-300" />
              </div>

              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">
                Latest Upload
              </p>

              <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
                {documents[0]
                  ? new Date(
                      documents[0].created_at
                    ).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          </section>
        )}

        {/* Loading */}
        {loading ? (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-16 text-center backdrop-blur-xl">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-indigo-300" />

            <p className="text-sm font-medium text-white/55">
              Loading your library...
            </p>
          </div>
        ) : documents.length === 0 ? (
          /* Empty state */
          <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.09] bg-white/[0.035] px-6 py-24 text-center shadow-2xl backdrop-blur-xl sm:px-10">
            <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />

            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl">
              <FileText className="h-9 w-9 text-indigo-200" />
            </div>

            <h2 className="relative mt-7 text-2xl font-semibold tracking-tight text-white">
              Your library is waiting
            </h2>

            <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-white/40">
              Upload your first document and turn it into an intelligent,
              searchable knowledge source with DocChatAI.
            </p>

            <Link
              href="/upload"
              className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-[#080910] transition hover:bg-white/90"
            >
              <Upload className="h-4 w-4" />
              Upload Your First Document
            </Link>
          </div>
        ) : (
          /* Document library */
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
                  Your Library
                </p>
              </div>

              <p className="text-sm text-white/30">
                {documents.length}{" "}
                {documents.length === 1 ? "document" : "documents"}
              </p>
            </div>

            <div className="space-y-3">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.055] hover:shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-5"
                >
                  {/* Hover glow */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-300 via-violet-400 to-blue-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.025] shadow-inner">
                        <FileText className="h-6 w-6 text-indigo-200" />

                        <span className="absolute -bottom-1 -right-1 rounded-md border border-[#070812] bg-indigo-400/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-indigo-200">
                          {formatFileType(document.mime_type)}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-white sm:text-[17px]">
                          {document.name}
                        </h2>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/35">
                          <span>
                            {new Date(
                              document.created_at
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>

                          <span className="h-1 w-1 rounded-full bg-white/20" />

                          <span>{formatFileSize(document.size)}</span>

                          <span className="h-1 w-1 rounded-full bg-white/20" />

                          <span className="text-emerald-300/70">
                            Ready for AI
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreview(document)}
                        className="group/preview inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-indigo-300/25 hover:bg-indigo-400/10 hover:text-white"
                      >
                        <Eye className="h-4 w-4 text-indigo-200 transition group-hover/preview:scale-110" />
                        Preview
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(document.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/30 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-300"
                        aria-label={`Delete ${document.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Luxury Preview Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02030a]/80 p-3 backdrop-blur-md sm:p-6">
          <div
            className="absolute inset-0"
            onClick={closePreview}
          />

          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/[0.12] bg-[#0b0d18] shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
            {/* Modal header */}
            <div className="relative border-b border-white/[0.08] bg-white/[0.025] px-5 py-5 sm:px-7">
              <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent" />

              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-300/15 bg-indigo-400/10">
                    <FileText className="h-5 w-5 text-indigo-200" />
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300/60">
                      Document Preview
                    </p>

                    <h2 className="truncate text-base font-semibold text-white sm:text-lg">
                      {selectedDocument.name}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closePreview}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {previewLoading ? (
                <div className="flex min-h-[55vh] flex-col items-center justify-center px-6">
                  <div className="relative mb-7">
                    <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl" />

                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-indigo-300" />
                    </div>
                  </div>

                  <p className="text-sm font-medium text-white/65">
                    Preparing your document...
                  </p>

                  <p className="mt-2 text-xs text-white/30">
                    Loading the intelligent preview
                  </p>
                </div>
              ) : (
                <div className="p-5 sm:p-8">
                  <div className="rounded-2xl border border-white/[0.07] bg-[#080a12] p-5 shadow-inner sm:p-8">
                    {previewText ? (
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-white/70">
                        {previewText}
                      </pre>
                    ) : (
                      <div className="py-16 text-center">
                        <FileText className="mx-auto mb-4 h-9 w-9 text-white/20" />

                        <p className="text-sm text-white/45">
                          No preview text available.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="border-t border-white/[0.08] bg-white/[0.02] px-5 py-4 sm:px-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-300/70" />
                  Powered by DocChatAI
                </div>

                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/65 transition hover:bg-white/[0.09] hover:text-white"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}