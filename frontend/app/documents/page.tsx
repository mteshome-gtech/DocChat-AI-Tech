"use client";

import { useEffect, useMemo, useState } from "react";
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
  Search,
  MessageSquare,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

type Document = {
  id: string;
  name: string;
  created_at: string;
  size?: number;
  mime_type?: string;
  file_name?: string;
};

type PreviewResponse = {
  text?: string;
  preview?: string;
  content?: string;
  detail?: string;
};

export default function DocumentsPage() {
  const supabase = createClient();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDocument, setSelectedDocument] =
    useState<Document | null>(null);

  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [filterType, setFilterType] = useState<
    "all" | "pdf" | "document" | "spreadsheet"
  >("all");

  const [deletingDocumentId, setDeletingDocumentId] =
    useState<string | null>(null);

  const [error, setError] = useState("");

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      setLoading(true);
      setError("");

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
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error("Error loading documents:", error);

        setError(
          "Unable to load your documents. Please try again."
        );

        return;
      }

      setDocuments((data || []) as Document[]);
    } catch (error) {
      console.error("Error loading documents:", error);

      setError(
        "Unable to load your document library."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(document: Document) {
    try {
      setSelectedDocument(document);
      setPreviewText("");
      setPreviewError("");
      setPreviewLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
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

      let data: PreviewResponse = {};

      try {
        data = await response.json();
      } catch {
        // Backend may return a non-JSON response.
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Failed to load document preview."
        );
      }

      const text =
        data.text ||
        data.preview ||
        data.content ||
        "";

      setPreviewText(text);

      if (!text) {
        setPreviewError(
          "The document was loaded, but no preview text was returned."
        );
      }
    } catch (error) {
      console.error("Preview error:", error);

      setPreviewError(
        error instanceof Error
          ? error.message
          : "Failed to load document preview."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDelete(documentId: string) {
    const document = documents.find(
      (item) => item.id === documentId
    );

    const confirmed = window.confirm(
      `Are you sure you want to delete "${
        document?.name || "this document"
      }"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingDocumentId(documentId);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
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
        let message = "Failed to delete document.";

        try {
          const data = await response.json();

          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Ignore non-JSON error responses.
        }

        throw new Error(message);
      }

      setDocuments((current) =>
        current.filter(
          (document) => document.id !== documentId
        )
      );

      if (selectedDocument?.id === documentId) {
        closePreview();
      }
    } catch (error) {
      console.error("Delete error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete document."
      );
    } finally {
      setDeletingDocumentId(null);
    }
  }

  function closePreview() {
    setSelectedDocument(null);
    setPreviewText("");
    setPreviewError("");
    setPreviewLoading(false);
  }

  function formatFileSize(size?: number) {
    if (!size || size <= 0) {
      return "Unknown size";
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    if (size < 1024 * 1024 * 1024) {
      return `${(
        size /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    }

    return `${(
      size /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  }

  function formatFileType(
    mimeType?: string,
    fileName?: string
  ) {
    if (mimeType) {
      if (mimeType.includes("pdf")) {
        return "PDF";
      }

      if (
        mimeType.includes("word") ||
        mimeType.includes("document")
      ) {
        return "DOCX";
      }

      if (mimeType.includes("text")) {
        return "TXT";
      }

      if (mimeType.includes("presentation")) {
        return "PPTX";
      }

      if (
        mimeType.includes("spreadsheet") ||
        mimeType.includes("excel")
      ) {
        return "XLSX";
      }

      if (mimeType.includes("image")) {
        return "IMAGE";
      }
    }

    const extension = fileName
      ?.split(".")
      .pop()
      ?.toUpperCase();

    return extension || "DOCUMENT";
  }

  function getExtension(document: Document) {
    return (
      document.file_name
        ?.split(".")
        .pop()
        ?.toLowerCase() ||
      document.name
        ?.split(".")
        .pop()
        ?.toLowerCase() ||
      ""
    );
  }

  function getDocumentCategory(document: Document) {
    const extension = getExtension(document);
    const mime = document.mime_type || "";

    if (
      extension === "pdf" ||
      mime.includes("pdf")
    ) {
      return "pdf";
    }

    if (
      ["xls", "xlsx", "csv"].includes(extension) ||
      mime.includes("spreadsheet") ||
      mime.includes("excel")
    ) {
      return "spreadsheet";
    }

    return "document";
  }

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesSearch =
        !query ||
        document.name
          .toLowerCase()
          .includes(query) ||
        document.file_name
          ?.toLowerCase()
          .includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (filterType === "all") {
        return true;
      }

      return (
        getDocumentCategory(document) ===
        filterType
      );
    });
  }, [
    documents,
    searchQuery,
    filterType,
  ]);

  const totalSize = documents.reduce(
    (total, document) =>
      total + (document.size || 0),
    0
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070812] text-white">
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
                Your private collection of intelligent
                documents, ready to analyze, explore,
                compare, and chat with.
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

        {!loading && (
          <section className="mb-8 grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={
                <FileCheck2 className="h-5 w-5 text-indigo-300" />
              }
              label="Documents"
              value={documents.length.toString()}
              iconClass="border-indigo-400/15 bg-indigo-400/10"
            />

            <StatCard
              icon={
                <HardDrive className="h-5 w-5 text-violet-300" />
              }
              label="Library Size"
              value={formatFileSize(totalSize)}
              iconClass="border-violet-400/15 bg-violet-400/10"
            />

            <StatCard
              icon={
                <Clock3 className="h-5 w-5 text-blue-300" />
              }
              label="Latest Upload"
              value={
                documents[0]
                  ? new Date(
                      documents[0].created_at
                    ).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                      }
                    )
                  : "—"
              }
              iconClass="border-blue-400/15 bg-blue-400/10"
            />
          </section>
        )}

        {error && (
          <section className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />

            <div className="flex-1">
              <p className="text-sm font-medium text-red-200">
                Something went wrong
              </p>

              <p className="mt-1 text-xs leading-5 text-red-200/60">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={loadDocuments}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300/10 bg-red-300/5 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-300/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </section>
        )}

        {loading ? (
          <LoadingState />
        ) : documents.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value)
                    }
                    placeholder="Search your documents..."
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-indigo-300/30 focus:bg-white/[0.04]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    label="All"
                    active={filterType === "all"}
                    onClick={() =>
                      setFilterType("all")
                    }
                  />

                  <FilterButton
                    label="PDF"
                    active={filterType === "pdf"}
                    onClick={() =>
                      setFilterType("pdf")
                    }
                  />

                  <FilterButton
                    label="Documents"
                    active={
                      filterType === "document"
                    }
                    onClick={() =>
                      setFilterType("document")
                    }
                  />

                  <FilterButton
                    label="Spreadsheets"
                    active={
                      filterType === "spreadsheet"
                    }
                    onClick={() =>
                      setFilterType("spreadsheet")
                    }
                  />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
                    Your Library
                  </p>

                  <p className="mt-1 text-xs text-white/20">
                    {filteredDocuments.length}{" "}
                    {filteredDocuments.length === 1
                      ? "document"
                      : "documents"}{" "}
                    shown
                  </p>
                </div>

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearchQuery("")
                    }
                    className="text-xs text-white/35 transition hover:text-white"
                  >
                    Clear search
                  </button>
                )}
              </div>

              {filteredDocuments.length === 0 ? (
                <FilteredEmptyState
                  onClear={() => {
                    setSearchQuery("");
                    setFilterType("all");
                  }}
                />
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map(
                    (document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        deleting={
                          deletingDocumentId ===
                          document.id
                        }
                        onPreview={() =>
                          handlePreview(document)
                        }
                        onDelete={() =>
                          handleDelete(document.id)
                        }
                        formatFileSize={
                          formatFileSize
                        }
                        formatFileType={
                          formatFileType
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedDocument && (
        <PreviewModal
          document={selectedDocument}
          previewText={previewText}
          previewLoading={previewLoading}
          previewError={previewError}
          onClose={closePreview}
          formatFileType={formatFileType}
        />
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconClass: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl transition hover:border-white/[0.14] hover:bg-white/[0.05]">
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${iconClass}`}
      >
        {icon}
      </div>

      <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2.5 text-xs font-medium transition ${
        active
          ? "border-indigo-300/30 bg-indigo-400/10 text-indigo-200"
          : "border-white/[0.08] bg-white/[0.025] text-white/40 hover:border-white/[0.15] hover:text-white/70"
      }`}
    >
      {label}
    </button>
  );
}

function DocumentRow({
  document,
  deleting,
  onPreview,
  onDelete,
  formatFileSize,
  formatFileType,
}: {
  document: Document;
  deleting: boolean;
  onPreview: () => void;
  onDelete: () => void;
  formatFileSize: (size?: number) => string;
  formatFileType: (
    mimeType?: string,
    fileName?: string
  ) => string;
}) {
  const extension =
    document.file_name
      ?.split(".")
      .pop()
      ?.toLowerCase() || "";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.055] hover:shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-300 via-violet-400 to-blue-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <DocumentIcon
            extension={extension}
            type={document.mime_type}
          />

          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white sm:text-[17px]">
              {document.name}
            </h2>

            {document.file_name &&
              document.file_name !==
                document.name && (
                <p className="mt-1 truncate text-xs text-white/25">
                  {document.file_name}
                </p>
              )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/35">
              <span>
                {new Date(
                  document.created_at
                ).toLocaleDateString(
                  undefined,
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }
                )}
              </span>

              <span className="h-1 w-1 rounded-full bg-white/20" />

              <span>
                {formatFileSize(
                  document.size
                )}
              </span>

              <span className="h-1 w-1 rounded-full bg-white/20" />

              <span className="text-emerald-300/70">
                Ready for AI
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/chat?document=${document.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-white/65 transition hover:border-indigo-300/25 hover:bg-indigo-400/10 hover:text-white"
          >
            <MessageSquare className="h-4 w-4 text-indigo-200" />

            <span className="hidden md:inline">
              Chat
            </span>
          </Link>

          <button
            type="button"
            onClick={onPreview}
            disabled={deleting}
            className="group/preview inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-indigo-300/25 hover:bg-indigo-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye className="h-4 w-4 text-indigo-200 transition group-hover/preview:scale-110" />

            <span className="hidden md:inline">
              Preview
            </span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/30 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Delete ${document.name}`}
          >
            {deleting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-red-300" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute right-5 top-3 hidden lg:block">
        <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-white/25">
          {formatFileType(
            document.mime_type,
            document.file_name ||
              document.name
          )}
        </span>
      </div>
    </div>
  );
}

function DocumentIcon({
  extension,
  type,
}: {
  extension: string;
  type?: string;
}) {
  if (
    extension === "pdf" ||
    type?.includes("pdf")
  ) {
    return (
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-300/10 bg-red-400/[0.06] shadow-inner">
        <FileText className="h-6 w-6 text-red-200" />

        <span className="absolute -bottom-1 -right-1 rounded-md border border-[#070812] bg-red-400/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-red-200">
          PDF
        </span>
      </div>
    );
  }

  if (
    ["xls", "xlsx", "csv"].includes(
      extension
    ) ||
    type?.includes("spreadsheet") ||
    type?.includes("excel")
  ) {
    return (
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.06] shadow-inner">
        <FileSpreadsheet className="h-6 w-6 text-emerald-200" />

        <span className="absolute -bottom-1 -right-1 rounded-md border border-[#070812] bg-emerald-400/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-emerald-200">
          XLS
        </span>
      </div>
    );
  }

  if (
    ["jpg", "jpeg", "png", "gif", "webp"].includes(
      extension
    )
  ) {
    return (
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-300/10 bg-violet-400/[0.06] shadow-inner">
        <FileImage className="h-6 w-6 text-violet-200" />
      </div>
    );
  }

  if (
    ["zip", "rar", "7z"].includes(
      extension
    )
  ) {
    return (
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/10 bg-amber-400/[0.06] shadow-inner">
        <FileArchive className="h-6 w-6 text-amber-200" />
      </div>
    );
  }

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.025] shadow-inner">
      <FileText className="h-6 w-6 text-indigo-200" />

      <span className="absolute -bottom-1 -right-1 rounded-md border border-[#070812] bg-indigo-400/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-indigo-200">
        DOC
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-16 text-center backdrop-blur-xl">
      <div className="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-indigo-300" />
      </div>

      <p className="text-sm font-medium text-white/55">
        Loading your library...
      </p>

      <p className="mt-2 text-xs text-white/25">
        Preparing your private documents
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.09] bg-white/[0.035] px-6 py-24 text-center shadow-2xl backdrop-blur-xl sm:px-10">
      <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />

      <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl">
        <FileText className="h-9 w-9 text-indigo-200" />
      </div>

      <h2 className="relative mt-7 text-2xl font-semibold tracking-tight text-white">
        Your library is waiting
      </h2>

      <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-white/40">
        Upload your first document and turn it
        into an intelligent, searchable knowledge
        source with DocChatAI.
      </p>

      <Link
        href="/upload"
        className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-[#080910] transition hover:bg-white/90"
      >
        <Upload className="h-4 w-4" />
        Upload Your First Document
      </Link>
    </div>
  );
}

function FilteredEmptyState({
  onClear,
}: {
  onClear: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-16 text-center backdrop-blur-xl">
      <Search className="mx-auto h-8 w-8 text-white/20" />

      <h3 className="mt-5 text-lg font-semibold text-white">
        No matching documents
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
        Try a different search term or change
        your document filter.
      </p>

      <button
        type="button"
        onClick={onClear}
        className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/[0.08] hover:text-white"
      >
        Clear Filters
      </button>
    </div>
  );
}

function PreviewModal({
  document,
  previewText,
  previewLoading,
  previewError,
  onClose,
  formatFileType,
}: {
  document: Document;
  previewText: string;
  previewLoading: boolean;
  previewError: string;
  onClose: () => void;
  formatFileType: (
    mimeType?: string,
    fileName?: string
  ) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02030a]/80 p-3 backdrop-blur-md sm:p-6">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/[0.12] bg-[#0b0d18] shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
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

                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-white sm:text-lg">
                    {document.name}
                  </h2>

                  <span className="hidden shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold tracking-wider text-white/30 sm:inline">
                    {formatFileType(
                      document.mime_type,
                      document.file_name ||
                        document.name
                    )}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

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
          ) : previewError ? (
            <div className="flex min-h-[55vh] items-center justify-center px-6">
              <div className="max-w-md rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-7 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-red-300/10 bg-red-400/[0.06]">
                  <AlertCircle className="h-5 w-5 text-red-300" />
                </div>

                <h3 className="mt-5 text-sm font-semibold text-red-200">
                  Preview unavailable
                </h3>

                <p className="mt-2 text-xs leading-6 text-red-200/50">
                  {previewError}
                </p>
              </div>
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

                    <p className="mt-2 text-xs text-white/25">
                      The document was loaded, but the
                      preview endpoint did not return
                      readable text.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.08] bg-white/[0.02] px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-white/30">
              <Sparkles className="h-3.5 w-3.5 text-indigo-300/70" />
              Powered by DocChatAI
            </div>

            <div className="flex gap-2">
              <Link
                href={`/chat?document=${document.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-300/15 bg-indigo-400/10 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-400/15"
              >
                <MessageSquare className="h-4 w-4" />
                Chat with Document
              </Link>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/65 transition hover:bg-white/[0.09] hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}