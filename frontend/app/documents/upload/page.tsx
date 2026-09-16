"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UploadedDocument = {
  id: string;
  name: string;
  file_size: number;
  chunks: number;
  words: number;
};

export default function Upload() {
  const router = useRouter();
  const supabase = createClient();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDocument, setUploadedDocument] =
    useState<UploadedDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const handleFile = (file: File) => {
    setError("");
    setSuccess("");

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PDF, DOCX, or TXT file.");
      return;
    }

    setSelectedFile(file);
    setUploadedDocument(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];

    if (file) {
      handleFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Your session has expired. Please sign in again.");
        router.push("/auth/signin");
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to upload the document."
        );
      }

      setUploadedDocument({
        id: data.document_id,
        name: data.filename,
        file_size: selectedFile.size,
        chunks: data.chunks,
        words: data.words,
      });

      setSuccess(
        `${data.filename} was uploaded and analyzed successfully.`
      );

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while uploading the document."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadedDocument(null);
    setError("");
    setSuccess("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-10">
      <Link
        href="/dashboard"
        className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-blue-600">
          Document Upload
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Upload a document.
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-slate-500">
          Upload a PDF, Word document, or text file to begin
          analyzing it with DocChatAI.
        </p>
      </section>

      {/* Upload Area */}
      <section className="border border-slate-200 bg-white p-8">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => {
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border border-dashed p-16 text-center transition ${
            isDragging
              ? "border-blue-600 bg-blue-50"
              : "border-slate-300 hover:border-blue-500 hover:bg-slate-50"
          }`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center border border-slate-200 bg-white text-2xl text-blue-600">
            ↑
          </div>

          <h2 className="mt-6 text-xl font-semibold text-slate-900">
            Drop your document here
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            or click to browse your computer
          </p>

          <p className="mt-5 text-xs text-slate-400">
            Supported formats: PDF, DOCX, TXT
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                handleFile(file);
              }
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mt-6 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-600">
            {success}
          </div>
        )}

        {/* Selected File */}
        {selectedFile && (
          <div className="mt-6 border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {selectedFile.name}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemove();
                }}
                className="text-sm text-slate-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Uploaded Document */}
        {uploadedDocument && (
          <div className="mt-6 border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {uploadedDocument.name}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {uploadedDocument.chunks} chunks ·{" "}
                  {uploadedDocument.words.toLocaleString()} words
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
                ✓
              </div>
            </div>
          </div>
        )}

        {/* Upload */}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={!selectedFile || isUploading}
            onClick={handleUpload}
            className="border border-blue-700 bg-blue-600 px-8 py-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading
              ? "Uploading & Analyzing..."
              : "Upload & Analyze"}
          </button>
        </div>
      </section>

      {/* What Happens Next */}
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-blue-600">
          What happens next
        </p>

        <div className="mt-6 grid grid-cols-3 gap-6">
          <ProcessCard
            number="01"
            title="Upload"
            description="Your document is securely uploaded to your workspace."
          />

          <ProcessCard
            number="02"
            title="Analyze"
            description="DocChatAI extracts and processes the document content."
          />

          <ProcessCard
            number="03"
            title="Ask AI"
            description="Ask questions and receive answers based on your document."
          />
        </div>
      </section>
    </div>
  );
}

function ProcessCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-blue-600">
        {number}
      </p>

      <h3 className="mt-4 text-lg font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}