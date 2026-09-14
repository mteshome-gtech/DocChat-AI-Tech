"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Trash2,
  FileText,
  ExternalLink,
  Download,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type DocumentRecord = {
  id: string;
  name: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string | null;
  created_at: string;
};

type PreviewState = {
  document: DocumentRecord;
  url: string;
} | null;

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export default function DocumentsPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [documents, setDocuments] = useState<
    DocumentRecord[]
  >([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [preview, setPreview] =
    useState<PreviewState>(null);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [previewError, setPreviewError] =
    useState("");

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "You must be signed in to view your documents."
        );
        return;
      }

      const {
        data,
        error: documentsError,
      } = await supabase
        .from("documents")
        .select(
          "id, name, file_name, file_type, file_size, status, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (documentsError) {
        console.error(
          "Documents error:",
          documentsError
        );

        setError(
          "Unable to load your documents."
        );

        return;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error(
        "Documents page error:",
        error
      );

      setError(
        "Something went wrong while loading your documents."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openPreview(
    document: DocumentRecord
  ) {
    try {
      setPreviewError("");
      setPreviewLoading(true);
      setPreview(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setPreviewError(
          "Your session has expired. Please sign in again."
        );
        return;
      }

      const response = await fetch(
        `${API_URL}/upload/${document.id}/preview`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        setPreviewError(
          data?.detail ||
            "Unable to load the document preview."
        );
        return;
      }

      if (!data?.url) {
        setPreviewError(
          "No preview URL was returned."
        );
        return;
      }

      setPreview({
        document,
        url: data.url,
      });
    } catch (error) {
      console.error(
        "Preview error:",
        error
      );

      setPreviewError(
        "Something went wrong while opening the document."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreview(null);
    setPreviewError("");
  }

  async function deleteDocument(
    document: DocumentRecord
  ) {
    const confirmed = window.confirm(
      `Delete "${document.name || document.file_name}"?\n\nThis will permanently remove the original file and its indexed AI content.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(document.id);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError(
          "Your session has expired. Please sign in again."
        );
        return;
      }

      const response = await fetch(
        `${API_URL}/upload/${document.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        setError(
          data?.detail ||
            "Unable to delete the document."
        );
        return;
      }

      setDocuments((current) =>
        current.filter(
          (item) =>
            item.id !== document.id
        )
      );

      if (
        preview?.document.id ===
        document.id
      ) {
        closePreview();
      }
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      setError(
        "Something went wrong while deleting the document."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredDocuments = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return documents;
    }

    return documents.filter(
      (document) => {
        const name =
          document.name ||
          document.file_name ||
          "";

        return name
          .toLowerCase()
          .includes(query);
      }
    );
  }, [documents, search]);

  const previewFileType =
    preview?.document.file_type
      ?.toLowerCase() || "";

  const isPdf =
    previewFileType.includes("pdf");

  const isDocx =
    previewFileType.includes("docx") ||
    previewFileType.includes("word");

  const isTxt =
    previewFileType.includes("text") ||
    previewFileType === ".txt" ||
    previewFileType === "txt";

  return (
    <>
      <div className="space-y-10">
        <Link
                href="/dashboard"
                className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900"
                >
                   ← Back to Dashboard
              </Link>
        <section>
          <p className="text-sm font-medium uppercase tracking-widest text-blue-600">
            Document Intelligence
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
            Your documents
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-slate-500">
            Upload, manage, analyze, and interact
            with your documents using AI.
          </p>
        </section>

        <section className="border border-slate-200 bg-white p-8">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Document Library
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Manage the files available to your AI
                workspace.
              </p>
            </div>

            <Link
              href="/documents/upload"
              className="inline-flex shrink-0 items-center justify-center border border-blue-700 bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Upload Document
            </Link>
          </div>
        </section>

        <section>
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="w-full border border-slate-200 bg-white px-5 py-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
          />
        </section>

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              All Documents
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Documents uploaded to your workspace.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">
                Loading your documents...
              </p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-500">
                {error}
              </p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">
                No documents uploaded yet.
              </p>

              <Link
                href="/documents/upload"
                className="mt-5 inline-block text-sm font-medium text-blue-600 transition hover:text-blue-700"
              >
                Upload your first document →
              </Link>
            </div>
          ) : filteredDocuments.length ===
            0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">
                No documents match your search.
              </p>
            </div>
          ) : (
            <div>
              {filteredDocuments.map(
                (document) => (
                  <div
                    key={document.id}
                    className="grid grid-cols-12 items-center border-b border-slate-100 px-6 py-5 last:border-0 hover:bg-slate-50"
                  >
                    <div className="col-span-4 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 bg-slate-50">
                          <FileText
                            size={18}
                            className="text-blue-600"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {document.name ||
                              document.file_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Uploaded{" "}
                            {formatUploadedDate(
                              document.created_at
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-sm text-slate-500">
                      {formatFileType(
                        document.file_type,
                        document.name ||
                          document.file_name
                      )}
                    </div>

                    <div className="col-span-2 text-sm text-slate-500">
                      {formatFileSize(
                        document.file_size
                      )}
                    </div>

                    <div className="col-span-2 text-sm text-blue-600">
                      {formatStatus(
                        document.status
                      )}
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-5">
                      <button
                        type="button"
                        onClick={() =>
                          openPreview(document)
                        }
                        disabled={
                          deletingId ===
                          document.id
                        }
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Open
                        <ExternalLink
                          size={14}
                        />
                      </button>

                      <button
                        type="button"
                        disabled={
                          deletingId ===
                          document.id
                        }
                        onClick={() =>
                          deleteDocument(
                            document
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={14} />

                        {deletingId ===
                        document.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {previewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="border border-slate-200 bg-white px-8 py-7 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

              <p className="text-sm font-medium text-slate-700">
                Opening original document...
              </p>
            </div>
          </div>
        </div>
      )}

      {previewError &&
        !previewLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md border border-slate-200 bg-white p-7 shadow-2xl">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-red-500">
                    Preview Error
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {previewError}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPreviewError("")
                  }
                  className="text-slate-400 transition hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPreviewError("")
                }
                className="mt-6 border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}

      {preview &&
        !previewLoading && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closePreview();
              }
            }}
          >
            <div className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-blue-100 bg-blue-50">
                    <FileText
                      size={18}
                      className="text-blue-600"
                    />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                      {preview.document.name ||
                        preview.document.file_name}
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatFileType(
                        preview.document.file_type,
                        preview.document.name ||
                          preview.document.file_name
                      )}{" "}
                      ·{" "}
                      {formatFileSize(
                        preview.document.file_size
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden items-center gap-1.5 border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
                  >
                    Open in New Tab
                    <ExternalLink
                      size={14}
                    />
                  </a>

                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={
                      preview.document.name ||
                      preview.document.file_name ||
                      "document"
                    }
                    className="hidden items-center gap-1.5 border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
                  >
                    <Download size={14} />
                    Download
                  </a>

                  <button
                    type="button"
                    onClick={closePreview}
                    aria-label="Close preview"
                    className="flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 bg-slate-100">
                {isPdf ? (
                  <iframe
                    src={preview.url}
                    title={
                      preview.document.name ||
                      "Document preview"
                    }
                    className="h-full w-full border-0"
                  />
                ) : isTxt ? (
                  <iframe
                    src={preview.url}
                    title={
                      preview.document.name ||
                      "Text document preview"
                    }
                    className="h-full w-full border-0 bg-white"
                  />
                ) : isDocx ? (
                  <div className="flex h-full items-center justify-center p-6">
                    <div className="max-w-md text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center border border-blue-100 bg-blue-50">
                        <FileText
                          size={28}
                          className="text-blue-600"
                        />
                      </div>

                      <h3 className="mt-6 text-xl font-semibold text-slate-900">
                        Original DOCX file
                      </h3>

                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        Your original DOCX file is
                        safely stored and has not been
                        reformatted. Your browser does
                        not natively render DOCX files
                        inside this preview window.
                      </p>

                      <div className="mt-6 flex items-center justify-center gap-3">
                        <a
                          href={preview.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 border border-blue-700 bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                          Open Original
                          <ExternalLink
                            size={15}
                          />
                        </a>

                        <a
                          href={preview.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={
                            preview.document.name ||
                            preview.document.file_name ||
                            "document.docx"
                          }
                          className="inline-flex items-center gap-2 border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Download size={15} />
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center p-6">
                    <div className="text-center">
                      <p className="text-sm text-slate-500">
                        This file type cannot be rendered
                        directly by the browser.
                      </p>

                      <a
                        href={preview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-5 inline-flex items-center gap-2 border border-blue-700 bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
                      >
                        Open Original File
                        <ExternalLink
                          size={15}
                        />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
                <p className="text-xs text-slate-400">
                  Viewing the original uploaded file.
                </p>

                <button
                  type="button"
                  onClick={closePreview}
                  className="border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

function formatFileSize(
  bytes: number | null
) {
  if (!bytes) {
    return "0 KB";
  }

  const megabytes =
    bytes / 1024 / 1024;

  if (megabytes < 1) {
    return `${(
      bytes / 1024
    ).toFixed(0)} KB`;
  }

  return `${megabytes.toFixed(
    2
  )} MB`;
}

function formatFileType(
  fileType: string | null,
  fileName: string | null
) {
  if (fileType) {
    const type =
      fileType.toLowerCase();

    if (type.includes("pdf")) {
      return "PDF";
    }

    if (
      type.includes("word") ||
      type.includes("docx")
    ) {
      return "DOCX";
    }

    if (
      type.includes("text") ||
      type === ".txt" ||
      type === "txt"
    ) {
      return "TXT";
    }

    return type
      .replace(".", "")
      .toUpperCase();
  }

  if (fileName) {
    const extension =
      fileName.split(".").pop();

    if (extension) {
      return extension.toUpperCase();
    }
  }

  return "FILE";
}

function formatStatus(
  status: string | null
) {
  if (!status) {
    return "Ready";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1)
  );
}

function formatUploadedDate(
  date: string
) {
  const uploadedDate =
    new Date(date);

  const now = new Date();

  const difference =
    now.getTime() -
    uploadedDate.getTime();

  const oneDay =
    24 * 60 * 60 * 1000;

  if (difference < oneDay) {
    return "Today";
  }

  if (
    difference <
    oneDay * 2
  ) {
    return "Yesterday";
  }

  return uploadedDate.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year:
        uploadedDate.getFullYear() !==
        now.getFullYear()
          ? "numeric"
          : undefined,
    }
  );
}