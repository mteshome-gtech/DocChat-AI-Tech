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

type FilterType = "all" | "pdf" | "document" | "spreadsheet";

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
  const [filterType, setFilterType] =
    useState<FilterType>("all");

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

      const contentType =
        response.headers.get("content-type") || "";

      let data: PreviewResponse = {};

      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = {};
        }
      } else {
        try {
          const rawText = await response.text();

          if (rawText) {
            data = {
              text: rawText,
            };
          }
        } catch {
          data = {};
        }
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
    <main className="min-h-screen bg-[#f8f8f6] text-black">
      <div className="mx-auto max-w-[1400px] px-6 py-8 sm:px-8 lg:px-10 lg:py-12">
        <header className="border-b border-black/10 pb-10">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-black/40 transition hover:text-black"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Dashboard
          </Link>

          <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-blue-600">
                <Sparkles className="h-3.5 w-3.5" />
                Your Knowledge Library
              </div>

              <h1 className="text-5xl font-medium tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                Documents.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-black/45 sm:text-base">
                Your private workspace for documents,
                insights, analysis, research, translation,
                and AI-powered conversations.
              </p>
            </div>

            <Link
              href="/upload"
              className="group inline-flex w-fit items-center gap-3 border border-black bg-black px-6 py-4 text-sm font-medium text-white transition hover:bg-black/85"
            >
              <Upload className="h-4 w-4" />
              Upload Document
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </header>

        {!loading && (
          <section className="grid border-x border-b border-black/10 sm:grid-cols-3">
            <StatCard
              icon={
                <FileCheck2 className="h-5 w-5" />
              }
              label="Documents"
              value={documents.length.toString()}
            />

            <StatCard
              icon={
                <HardDrive className="h-5 w-5" />
              }
              label="Library Size"
              value={formatFileSize(totalSize)}
            />

            <StatCard
              icon={
                <Clock3 className="h-5 w-5" />
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
            />
          </section>
        )}

        {error && (
          <section className="mt-8 flex items-start gap-3 border border-red-500/20 bg-red-50 px-4 py-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />

            <div className="flex-1">
              <p className="text-sm font-medium text-red-700">
                Something went wrong
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600/70">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={loadDocuments}
              className="inline-flex items-center gap-2 border border-red-500/20 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </section>
        )}

        {loading ? (
          <div className="mt-10">
            <LoadingState />
          </div>
        ) : documents.length === 0 ? (
          <div className="mt-10">
            <EmptyState />
          </div>
        ) : (
          <>
            <section className="mt-10 border border-black/10 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value)
                    }
                    placeholder="Search your documents..."
                    className="w-full border border-black/10 bg-[#fafafa] py-3.5 pl-11 pr-4 text-sm text-black outline-none transition placeholder:text-black/25 focus:border-black"
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

            <section className="mt-10">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/35">
                    Your Library
                  </p>

                  <p className="mt-2 text-sm text-black/35">
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
                    className="text-xs uppercase tracking-[0.15em] text-black/35 transition hover:text-black"
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
                <div className="border-t border-black/10">
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
                          handleDelete(
                            document.id
                          )
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-r border-black/10 p-5 last:border-r-0 sm:p-6">
      <div className="mb-5 flex h-10 w-10 items-center justify-center border border-black/10 bg-[#fafafa] text-blue-600">
        {icon}
      </div>

      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/35">
        {label}
      </p>

      <p className="mt-2 text-2xl font-medium tracking-[-0.04em]">
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
      className={`border px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] transition ${
        active
          ? "border-black bg-black text-white"
          : "border-black/10 bg-white text-black/45 hover:border-black/25 hover:text-black"
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
    <div className="group relative border-b border-black/10 bg-white px-4 py-5 transition hover:bg-[#fafafa] sm:px-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <DocumentIcon
            extension={extension}
            type={document.mime_type}
          />

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <h2 className="truncate text-base font-medium tracking-[-0.02em] sm:text-[17px]">
                {document.name}
              </h2>

              <span className="hidden shrink-0 border border-black/10 bg-[#fafafa] px-2 py-1 text-[9px] font-bold tracking-[0.15em] text-black/35 sm:inline">
                {formatFileType(
                  document.mime_type,
                  document.file_name ||
                    document.name
                )}
              </span>
            </div>

            {document.file_name &&
              document.file_name !==
                document.name && (
                <p className="mt-1 truncate text-xs text-black/30">
                  {document.file_name}
                </p>
              )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-black/35">
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

              <span className="h-1 w-1 rounded-full bg-black/15" />

              <span>
                {formatFileSize(
                  document.size
                )}
              </span>

              <span className="h-1 w-1 rounded-full bg-black/15" />

              <span className="text-emerald-600">
                Ready for AI
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/chat?document=${document.id}`}
            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black/55 transition hover:border-black hover:bg-black hover:text-white"
          >
            <MessageSquare className="h-4 w-4" />

            <span className="hidden md:inline">
              Chat
            </span>
          </Link>

          <button
            type="button"
            onClick={onPreview}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black/55 transition hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye className="h-4 w-4" />

            <span className="hidden md:inline">
              Preview
            </span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-black/30 transition hover:border-red-500/30 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Delete ${document.name}`}
          >
            {deleting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/10 border-t-red-500" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
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
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center border border-red-500/15 bg-red-50">
        <FileText className="h-6 w-6 text-red-500" />

        <span className="absolute -bottom-1 -right-1 border border-red-500/10 bg-white px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-red-500">
          PDF
        </span>
      </div>
    );
  }

  if (
    ["xls", "xlsx", "csv"].includes(extension) ||
    type?.includes("spreadsheet") ||
    type?.includes("excel")
  ) {
    return (
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center border border-emerald-500/15 bg-emerald-50">
        <FileSpreadsheet className="h-6 w-6 text-emerald-600" />

        <span className="absolute -bottom-1 -right-1 border border-emerald-500/10 bg-white px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-emerald-600">
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
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center border border-violet-500/15 bg-violet-50">
        <FileImage className="h-6 w-6 text-violet-600" />
      </div>
    );
  }

  if (
    ["zip", "rar", "7z"].includes(extension)
  ) {
    return (
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center border border-amber-500/15 bg-amber-50">
        <FileArchive className="h-6 w-6 text-amber-600" />
      </div>
    );
  }

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center border border-blue-500/15 bg-blue-50">
      <FileText className="h-6 w-6 text-blue-600" />

      <span className="absolute -bottom-1 -right-1 border border-blue-500/10 bg-white px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-blue-600">
        DOC
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="border border-black/10 bg-white p-16 text-center">
      <div className="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center border border-black/10 bg-[#fafafa]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-blue-600" />
      </div>

      <p className="text-sm font-medium">
        Loading your library...
      </p>

      <p className="mt-2 text-xs text-black/35">
        Preparing your private documents
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-black/10 bg-white px-6 py-24 text-center sm:px-10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center border border-black/10 bg-[#fafafa]">
        <FileText className="h-9 w-9 text-blue-600" />
      </div>

      <h2 className="mt-7 text-3xl font-medium tracking-[-0.05em]">
        Your library is waiting.
      </h2>

      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-black/40">
        Upload your first document and turn it
        into an intelligent, searchable knowledge
        source with DocChatAI.
      </p>

      <Link
        href="/upload"
        className="mt-8 inline-flex items-center gap-3 border border-black bg-black px-6 py-4 text-sm font-medium text-white transition hover:bg-black/85"
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
    <div className="border border-black/10 bg-white p-16 text-center">
      <Search className="mx-auto h-8 w-8 text-black/20" />

      <h3 className="mt-5 text-xl font-medium">
        No matching documents.
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/40">
        Try a different search term or change
        your document filter.
      </p>

      <button
        type="button"
        onClick={onClear}
        className="mt-6 border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-black/55 transition hover:border-black hover:text-black"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-6">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-black/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.2)]">
        <div className="border-b border-black/10 px-5 py-5 sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-blue-500/15 bg-blue-50">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Document Preview
                </p>

                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-medium sm:text-lg">
                    {document.name}
                  </h2>

                  <span className="hidden shrink-0 border border-black/10 bg-[#fafafa] px-2 py-1 text-[9px] font-bold tracking-wider text-black/35 sm:inline">
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
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-white text-black/40 transition hover:border-black hover:text-black"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {previewLoading ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center px-6">
              <div className="mb-7 flex h-16 w-16 items-center justify-center border border-black/10 bg-[#fafafa]">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-blue-600" />
              </div>

              <p className="text-sm font-medium">
                Preparing your document...
              </p>

              <p className="mt-2 text-xs text-black/35">
                Loading the intelligent preview
              </p>
            </div>
          ) : previewError ? (
            <div className="flex min-h-[55vh] items-center justify-center px-6">
              <div className="max-w-md border border-red-500/20 bg-red-50 p-7 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center border border-red-500/10 bg-white">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>

                <h3 className="mt-5 text-sm font-semibold text-red-700">
                  Preview unavailable
                </h3>

                <p className="mt-2 text-xs leading-6 text-red-600/60">
                  {previewError}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-8">
              <div className="border border-black/10 bg-[#fafafa] p-5 sm:p-8">
                {previewText ? (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-black/70">
                    {previewText}
                  </pre>
                ) : (
                  <div className="py-16 text-center">
                    <FileText className="mx-auto mb-4 h-9 w-9 text-black/20" />

                    <p className="text-sm text-black/45">
                      No preview text available.
                    </p>

                    <p className="mt-2 text-xs text-black/30">
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

        <div className="border-t border-black/10 bg-[#fafafa] px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-black/30">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              Powered by DocChatAI
            </div>

            <div className="flex gap-2">
              <Link
                href={`/chat?document=${document.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/85"
              >
                <MessageSquare className="h-4 w-4" />
                Chat with Document
              </Link>

              <button
                type="button"
                onClick={onClose}
                className="border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/55 transition hover:border-black hover:text-black"
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