"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FileText, Trash2, Eye, ArrowLeft } from "lucide-react";

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
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
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

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>

            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="mt-2 text-gray-600">
              View and manage your uploaded documents.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-20 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />

            <h2 className="text-xl font-semibold">No documents yet</h2>

            <p className="mt-2 text-gray-500">
              Upload a document to start using DocChatAI.
            </p>

            <Link
              href="/upload"
              className="mt-6 inline-flex rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Upload Document
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    <FileText className="h-6 w-6 text-gray-700" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">
                      {document.name}
                    </h2>

                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
                      <span>
                        {new Date(document.created_at).toLocaleDateString()}
                      </span>

                      <span>{formatFileSize(document.size)}</span>

                      {document.mime_type && (
                        <span>{document.mime_type}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePreview(document)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(document.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${document.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedDocument && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
            <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">
                    {selectedDocument.name}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDocument(null);
                    setPreviewText("");
                  }}
                  className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[calc(85vh-80px)] overflow-y-auto p-6">
                {previewLoading ? (
                  <div className="py-20 text-center text-gray-500">
                    Loading preview...
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-800">
                    {previewText || "No preview text available."}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}