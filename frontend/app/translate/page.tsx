"use client";

import React, {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Language = {
  name: string;
  code: string;
};

type DocumentItem = {
  id: string;
  name?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  status?: string;
  word_count?: number;
};

type TranslationResult = {
  success: boolean;
  document_id?: string;
  filename?: string;
  source_language?: string;
  target_language?: string;
  saved?: boolean;
  status?: string;
  preview_url?: string | null;
  download_url?: string | null;
  translated_text?: string;
};

const LANGUAGES: Language[] = [
  { name: "English", code: "English" },
  { name: "Spanish", code: "Spanish" },
  { name: "French", code: "French" },
  { name: "German", code: "German" },
  { name: "Italian", code: "Italian" },
  { name: "Portuguese", code: "Portuguese" },
  { name: "Dutch", code: "Dutch" },
  { name: "Russian", code: "Russian" },
  { name: "Ukrainian", code: "Ukrainian" },
  { name: "Polish", code: "Polish" },
  { name: "Turkish", code: "Turkish" },
  { name: "Greek", code: "Greek" },
  { name: "Arabic", code: "Arabic" },
  { name: "Hebrew", code: "Hebrew" },
  { name: "Persian", code: "Persian" },
  { name: "Urdu", code: "Urdu" },
  { name: "Pashto", code: "Pashto" },
  { name: "Hindi", code: "Hindi" },
  { name: "Bengali", code: "Bengali" },
  { name: "Punjabi", code: "Punjabi" },
  { name: "Gujarati", code: "Gujarati" },
  { name: "Tamil", code: "Tamil" },
  { name: "Telugu", code: "Telugu" },
  { name: "Chinese", code: "Chinese" },
  { name: "Japanese", code: "Japanese" },
  { name: "Korean", code: "Korean" },
  { name: "Vietnamese", code: "Vietnamese" },
  { name: "Thai", code: "Thai" },
  { name: "Indonesian", code: "Indonesian" },
  { name: "Malay", code: "Malay" },
  { name: "Filipino", code: "Filipino" },
  { name: "Swedish", code: "Swedish" },
  { name: "Norwegian", code: "Norwegian" },
  { name: "Danish", code: "Danish" },
  { name: "Finnish", code: "Finnish" },
  { name: "Czech", code: "Czech" },
  { name: "Romanian", code: "Romanian" },
  { name: "Hungarian", code: "Hungarian" },
  { name: "Bulgarian", code: "Bulgarian" },
  { name: "Croatian", code: "Croatian" },
  { name: "Serbian", code: "Serbian" },
  { name: "Slovak", code: "Slovak" },
  { name: "Slovenian", code: "Slovenian" },
  { name: "Lithuanian", code: "Lithuanian" },
  { name: "Latvian", code: "Latvian" },
  { name: "Estonian", code: "Estonian" },
  { name: "Swahili", code: "Swahili" },
  { name: "Afrikaans", code: "Afrikaans" },
  { name: "Amharic", code: "Amharic" },
  { name: "Somali", code: "Somali" },
  { name: "Other", code: "Other" },
];

const RTL_LANGUAGES = new Set([
  "Arabic",
  "Hebrew",
  "Persian",
  "Farsi",
  "Urdu",
  "Pashto",
]);

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getDocumentName(document: DocumentItem): string {
  return document.file_name || document.name || "Untitled document";
}

function getFriendlyError(
  response: Response,
  data: any,
): string {
  if (response.status === 503) {
    return "Translation is temporarily unavailable. Please try again shortly.";
  }

  if (response.status === 502) {
    return "We couldn't complete this translation. Your original document was not changed.";
  }

  if (response.status === 400) {
    if (
      typeof data?.detail === "string" &&
      data.detail.length > 0
    ) {
      return data.detail;
    }

    return "Please check the document and translation settings.";
  }

  if (response.status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (response.status === 404) {
    return "The selected document could not be found.";
  }

  return "Something went wrong while translating. Please try again.";
}

function FileIcon({
  type,
  large = false,
}: {
  type?: string;
  large?: boolean;
}) {
  const isPdf = type?.toLowerCase().includes("pdf");

  return (
    <div
      className={[
        "relative flex shrink-0 items-center justify-center border border-black/10 bg-[#f2f0eb] text-[10px] font-bold tracking-[0.16em] text-black",
        large ? "h-16 w-14" : "h-11 w-10",
      ].join(" ")}
    >
      <div
        className={[
          "absolute left-0 top-0 border-b border-r border-black/10 bg-white",
          large ? "h-4 w-4" : "h-3 w-3",
        ].join(" ")}
      />
      <span>{isPdf ? "PDF" : "TXT"}</span>
    </div>
  );
}

export default function TranslatePage() {
  const [mode, setMode] = useState<"text" | "document">("document");

  const [sourceLanguage, setSourceLanguage] =
    useState("English");

  const [targetLanguage, setTargetLanguage] =
    useState("Amharic");

  const [text, setText] = useState("");

  const [file, setFile] = useState<File | null>(null);

  const [selectedDocument, setSelectedDocument] =
    useState<DocumentItem | null>(null);

  const [documents, setDocuments] =
    useState<DocumentItem[]>([]);

  const [loadingDocuments, setLoadingDocuments] =
    useState(false);

  const [documentsError, setDocumentsError] =
    useState("");

  const [sourceMode, setSourceMode] =
    useState<"upload" | "library">("upload");

  const [translating, setTranslating] =
    useState(false);

  const [translationStage, setTranslationStage] =
    useState("");

  const [error, setError] = useState("");

  const [result, setResult] =
    useState<TranslationResult | null>(null);

  const [localPreviewUrl, setLocalPreviewUrl] =
    useState<string | null>(null);

  const [libraryPreviewUrl, setLibraryPreviewUrl] =
    useState<string | null>(null);

  const [libraryOpen, setLibraryOpen] =
    useState(false);

  const selectedTargetIsRTL = useMemo(
    () => RTL_LANGUAGES.has(targetLanguage),
    [targetLanguage],
  );

  const selectedSourceIsRTL = useMemo(
    () => RTL_LANGUAGES.has(sourceLanguage),
    [sourceLanguage],
  );

  async function getAccessToken(): Promise<string> {
    const supabase = createClient();

    const {
      data,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (
      sessionError ||
      !data.session?.access_token
    ) {
      throw new Error(
        "Your session has expired. Please sign in again.",
      );
    }

    return data.session.access_token;
  }

  async function loadDocuments() {
    setLoadingDocuments(true);
    setDocumentsError("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/upload/documents`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to load your documents.",
        );
      }

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.documents)
          ? data.documents
          : [];

      setDocuments(items);
    } catch (err: any) {
      setDocumentsError(
        err?.message ||
          "Unable to load your documents.",
      );
    } finally {
      setLoadingDocuments(false);
    }
  }

  useEffect(() => {
    if (
      mode === "document" &&
      sourceMode === "library" &&
      libraryOpen
    ) {
      void loadDocuments();
    }
  }, [
    mode,
    sourceMode,
    libraryOpen,
  ]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    return () => {
      if (libraryPreviewUrl) {
        URL.revokeObjectURL(libraryPreviewUrl);
      }
    };
  }, [libraryPreviewUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!selectedDocument) {
        setLibraryPreviewUrl(null);
        return;
      }

      const fileType =
        selectedDocument.file_type?.toLowerCase() || "";

      if (!fileType.includes("pdf")) {
        setLibraryPreviewUrl(null);
        return;
      }

      try {
        const token = await getAccessToken();

        const response = await fetch(
          `${API_BASE_URL}/upload/${selectedDocument.id}/preview`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (
          !response.ok ||
          typeof data?.url !== "string"
        ) {
          return;
        }

        if (!cancelled) {
          setLibraryPreviewUrl(data.url);
        }
      } catch {
        if (!cancelled) {
          setLibraryPreviewUrl(null);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [selectedDocument]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selected =
      event.target.files?.[0] || null;

    setError("");
    setResult(null);
    setSelectedDocument(null);
    setLibraryPreviewUrl(null);

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }

    if (!selected) {
      setFile(null);
      return;
    }

    const extension =
      selected.name
        .split(".")
        .pop()
        ?.toLowerCase();

    if (
      !extension ||
      !["pdf", "txt"].includes(extension)
    ) {
      setFile(null);
      setError(
        "Please select a PDF or TXT document.",
      );
      event.target.value = "";
      return;
    }

    setFile(selected);

    if (extension === "pdf") {
      setLocalPreviewUrl(
        URL.createObjectURL(selected),
      );
    }
  }

  function handleDocumentSelect(
    document: DocumentItem,
  ) {
    setSelectedDocument(document);
    setFile(null);
    setResult(null);
    setError("");
    setLibraryOpen(false);

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }

    setLibraryPreviewUrl(null);
  }

  function changeSourceMode(
    nextMode: "upload" | "library",
  ) {
    setSourceMode(nextMode);
    setError("");
    setResult(null);

    if (nextMode === "upload") {
      setSelectedDocument(null);
      setLibraryOpen(false);
      setLibraryPreviewUrl(null);
    } else {
      setFile(null);

      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }

      setLibraryOpen(true);
    }
  }

  async function handleTextTranslation(
    event: FormEvent,
  ) {
    event.preventDefault();

    setError("");
    setResult(null);

    if (!text.trim()) {
      setError("Please enter text to translate.");
      return;
    }

    if (sourceLanguage === targetLanguage) {
      setError("Choose two different languages.");
      return;
    }

    setTranslating(true);
    setTranslationStage("Translating your text...");

    try {
      const token = await getAccessToken();

      const formData = new FormData();

      formData.append("text", text);
      formData.append(
        "source_language",
        sourceLanguage,
      );
      formData.append(
        "target_language",
        targetLanguage,
      );

      const response = await fetch(
        `${API_BASE_URL}/translate/text`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getFriendlyError(response, data),
        );
      }

      setResult(data);
    } catch (err: any) {
      setError(
        err?.message ||
          "Translation failed. Please try again.",
      );
    } finally {
      setTranslating(false);
      setTranslationStage("");
    }
  }

  async function handleDocumentTranslation(
    event: FormEvent,
  ) {
    event.preventDefault();

    setError("");
    setResult(null);

    if (!file && !selectedDocument) {
      setError(
        "Upload a document or select one from My Documents.",
      );
      return;
    }

    if (file && selectedDocument) {
      setError(
        "Choose either an uploaded document or a document from your library.",
      );
      return;
    }

    if (sourceLanguage === targetLanguage) {
      setError("Choose two different languages.");
      return;
    }

    setTranslating(true);
    setTranslationStage(
      "Preparing your document...",
    );

    try {
      const token = await getAccessToken();

      const formData = new FormData();

      if (file) {
        formData.append("file", file);
      }

      if (selectedDocument) {
        formData.append(
          "document_id",
          selectedDocument.id,
        );
      }

      formData.append(
        "source_language",
        sourceLanguage,
      );

      formData.append(
        "target_language",
        targetLanguage,
      );

      formData.append(
        "save_to_account",
        "true",
      );

      setTranslationStage(
        "Translating your document...",
      );

      const response = await fetch(
        `${API_BASE_URL}/translate/document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getFriendlyError(response, data),
        );
      }

      setTranslationStage(
        "Saving your translated document...",
      );

      setResult(data);
      setTranslationStage(
        "Translation complete.",
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "We couldn't complete the translation. Please try again.",
      );
    } finally {
      setTranslating(false);

      setTimeout(() => {
        setTranslationStage("");
      }, 1500);
    }
  }

  function resetTranslation() {
    setFile(null);
    setSelectedDocument(null);
    setResult(null);
    setError("");
    setTranslationStage("");
    setLibraryPreviewUrl(null);

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
  }

  const originalPreviewUrl =
    selectedDocument
      ? libraryPreviewUrl
      : localPreviewUrl;

  const translatedPreviewUrl =
    result?.preview_url ||
    result?.download_url ||
    null;

  const currentDocumentName =
    file?.name ||
    (selectedDocument
      ? getDocumentName(selectedDocument)
      : "");

  return (
    <div className="min-h-screen bg-[#f3f1ed] text-[#111111]">
      <div className="mx-auto w-full max-w-[1500px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        {/* HEADER */}

        <header className="mb-10 border-b border-black/10 pb-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="h-2 w-2 bg-black" />

                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-black/50">
                  DOCCHATAI / TRANSLATE
                </span>
              </div>

              <h1 className="max-w-4xl text-[42px] font-medium leading-[0.95] tracking-[-0.045em] sm:text-6xl lg:text-[76px]">
                Translation,
                <br />
                <span className="text-black/35">
                  precisely delivered.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-sm leading-6 text-black/55 sm:text-base">
                Translate documents and text while
                maintaining the character of the
                original material.
              </p>
            </div>

            <div className="flex shrink-0 items-center border border-black/10 bg-white">
              <button
                type="button"
                onClick={() => {
                  setMode("document");
                  setError("");
                  setResult(null);
                }}
                className={[
                  "border-r border-black/10 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] transition",
                  mode === "document"
                    ? "bg-black text-white"
                    : "text-black/45 hover:bg-black/[0.03]",
                ].join(" ")}
              >
                Documents
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("text");
                  setError("");
                  setResult(null);
                }}
                className={[
                  "px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] transition",
                  mode === "text"
                    ? "bg-black text-white"
                    : "text-black/45 hover:bg-black/[0.03]",
                ].join(" ")}
              >
                Text
              </button>
            </div>
          </div>
        </header>

        {/* LANGUAGE BAR */}

        <section className="mb-6 border border-black/10 bg-white">
          <div className="grid md:grid-cols-[1fr_90px_1fr]">
            <div className="border-b border-black/10 p-6 md:border-b-0 md:border-r">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/40">
                  Source language
                </span>

                <span className="text-[10px] font-mono text-black/25">
                  01
                </span>
              </div>

              <select
                value={sourceLanguage}
                onChange={(event) =>
                  setSourceLanguage(event.target.value)
                }
                disabled={translating}
                dir={
                  selectedSourceIsRTL
                    ? "rtl"
                    : "ltr"
                }
                className="w-full appearance-none border-0 bg-transparent p-0 text-2xl font-medium tracking-tight outline-none"
              >
                {LANGUAGES.map((language) => (
                  <option
                    key={language.code}
                    value={language.code}
                  >
                    {language.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden items-center justify-center border-b border-black/10 md:flex md:border-b-0 md:border-r">
              <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f3f1ed] text-sm">
                →
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/40">
                  Target language
                </span>

                <span className="text-[10px] font-mono text-black/25">
                  02
                </span>
              </div>

              <select
                value={targetLanguage}
                onChange={(event) =>
                  setTargetLanguage(event.target.value)
                }
                disabled={translating}
                dir={
                  selectedTargetIsRTL
                    ? "rtl"
                    : "ltr"
                }
                className="w-full appearance-none border-0 bg-transparent p-0 text-2xl font-medium tracking-tight outline-none"
              >
                {LANGUAGES.map((language) => (
                  <option
                    key={language.code}
                    value={language.code}
                  >
                    {language.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* TEXT TRANSLATION */}

        {mode === "text" && (
          <form
            onSubmit={handleTextTranslation}
            className="border border-black/10 bg-white"
          >
            <div className="grid lg:grid-cols-2">
              <div className="border-b border-black/10 lg:border-b-0 lg:border-r">
                <div className="flex h-14 items-center justify-between border-b border-black/10 px-5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/40">
                    Original
                  </span>

                  <span className="text-[10px] font-mono text-black/30">
                    {text.length.toLocaleString()} CHARS
                  </span>
                </div>

                <textarea
                  value={text}
                  onChange={(event) =>
                    setText(event.target.value)
                  }
                  placeholder="Start writing or paste your text..."
                  disabled={translating}
                  dir={
                    selectedSourceIsRTL
                      ? "rtl"
                      : "ltr"
                  }
                  className="min-h-[500px] w-full resize-none border-0 bg-white p-7 text-lg leading-8 outline-none placeholder:text-black/20"
                />
              </div>

              <div>
                <div className="flex h-14 items-center justify-between border-b border-black/10 px-5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/40">
                    Translation
                  </span>

                  <span className="text-[10px] font-mono text-black/30">
                    {targetLanguage.toUpperCase()}
                  </span>
                </div>

                <div
                  dir={
                    selectedTargetIsRTL
                      ? "rtl"
                      : "ltr"
                  }
                  className="min-h-[500px] whitespace-pre-wrap p-7 text-lg leading-8"
                >
                  {translating ? (
                    <div className="flex h-[430px] items-center justify-center">
                      <div className="text-center">
                        <div className="mx-auto mb-5 h-8 w-8 animate-spin border-2 border-black/10 border-t-black" />

                        <p className="text-sm font-medium">
                          Translating...
                        </p>

                        <p className="mt-2 text-xs text-black/35">
                          {translationStage}
                        </p>
                      </div>
                    </div>
                  ) : result?.translated_text ? (
                    result.translated_text
                  ) : (
                    <span className="text-black/20">
                      Your translated text will appear here.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="border-t border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-4 border-t border-black/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-black/35">
                Translation powered by DocChatAI.
              </p>

              <button
                type="submit"
                disabled={
                  translating ||
                  !text.trim()
                }
                className="bg-black px-7 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {translating
                  ? "Translating..."
                  : "Translate Text →"}
              </button>
            </div>
          </form>
        )}

        {/* DOCUMENT TRANSLATION */}

        {mode === "document" && (
          <>
            <section className="border border-black/10 bg-white">
              {/* SOURCE HEADER */}

              <div className="flex flex-col border-b border-black/10 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex h-16 items-center border-b border-black/10 px-6 lg:border-b-0">
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/40">
                    Source document
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:flex">
                  <button
                    type="button"
                    disabled={translating}
                    onClick={() =>
                      changeSourceMode("upload")
                    }
                    className={[
                      "border-r border-black/10 px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] transition",
                      sourceMode === "upload"
                        ? "bg-black text-white"
                        : "text-black/40 hover:bg-black/[0.03]",
                    ].join(" ")}
                  >
                    Upload
                  </button>

                  <button
                    type="button"
                    disabled={translating}
                    onClick={() =>
                      changeSourceMode("library")
                    }
                    className={[
                      "px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] transition",
                      sourceMode === "library"
                        ? "bg-black text-white"
                        : "text-black/40 hover:bg-black/[0.03]",
                    ].join(" ")}
                  >
                    My Documents
                  </button>
                </div>
              </div>

              {/* UPLOAD */}

              {sourceMode === "upload" && (
                <div className="grid lg:grid-cols-[1fr_1fr]">
                  <div className="border-b border-black/10 p-6 lg:border-b-0 lg:border-r lg:p-8">
                    <label
                      htmlFor="document-upload"
                      className={[
                        "group flex min-h-[360px] cursor-pointer flex-col items-center justify-center border border-dashed border-black/20 bg-[#f7f6f3] px-8 text-center transition hover:border-black/40 hover:bg-[#f2f0eb]",
                        translating
                          ? "pointer-events-none opacity-50"
                          : "",
                      ].join(" ")}
                    >
                      <div className="mb-7 flex h-20 w-20 items-center justify-center border border-black/10 bg-white text-3xl font-light transition group-hover:-translate-y-1">
                        +
                      </div>

                      <p className="text-xl font-medium tracking-tight">
                        {file
                          ? file.name
                          : "Drop your document here"}
                      </p>

                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-black/35">
                        PDF or TXT
                      </p>

                      {file && (
                        <div className="mt-5 border border-black/10 bg-white px-4 py-2 text-xs font-mono text-black/50">
                          {formatFileSize(file.size)}
                        </div>
                      )}

                      <input
                        id="document-upload"
                        type="file"
                        accept=".pdf,.txt,application/pdf,text/plain"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={translating}
                      />
                    </label>
                  </div>

                  {/* UPLOAD PREVIEW */}

                  <div className="bg-[#ebe9e4] p-6 lg:p-8">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/40">
                          Document preview
                        </p>

                        <p className="mt-2 max-w-[300px] truncate text-sm font-medium">
                          {file?.name ||
                            "No document selected"}
                        </p>
                      </div>

                      <span className="text-[9px] font-mono text-black/30">
                        ORIGINAL
                      </span>
                    </div>

                    {originalPreviewUrl &&
                    file?.name
                      .toLowerCase()
                      .endsWith(".pdf") ? (
                      <iframe
                        src={originalPreviewUrl}
                        title="Original document preview"
                        className="h-[470px] w-full border border-black/10 bg-white"
                      />
                    ) : (
                      <div className="flex h-[470px] items-center justify-center border border-black/10 bg-white">
                        <div className="text-center">
                          <FileIcon
                            type={file?.name}
                            large
                          />

                          <p className="mt-5 text-sm font-medium">
                            {file
                              ? "Text document ready"
                              : "Preview unavailable"}
                          </p>

                          <p className="mt-2 text-xs text-black/35">
                            {file
                              ? "TXT files do not require visual preview."
                              : "Select a PDF to preview it here."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* LIBRARY */}

              {sourceMode === "library" && (
                <div className="p-6 lg:p-8">
                  {!selectedDocument ? (
                    <button
                      type="button"
                      onClick={() =>
                        setLibraryOpen(true)
                      }
                      disabled={translating}
                      className="group flex min-h-[260px] w-full flex-col items-center justify-center border border-black/10 bg-[#f7f6f3] transition hover:border-black/30 hover:bg-[#f2f0eb]"
                    >
                      <div className="mb-6 flex h-16 w-16 items-center justify-center border border-black/10 bg-white transition group-hover:-translate-y-1">
                        <span className="text-xl">
                          □
                        </span>
                      </div>

                      <p className="text-xl font-medium tracking-tight">
                        Choose from My Documents
                      </p>

                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-black/35">
                        Browse your document library
                      </p>
                    </button>
                  ) : (
                    <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
                      <div className="border border-black/10 bg-[#f7f6f3] p-6">
                        <div className="flex items-start justify-between gap-5">
                          <div className="flex items-start gap-4">
                            <FileIcon
                              type={
                                selectedDocument.file_type
                              }
                              large
                            />

                            <div className="min-w-0">
                              <p className="break-words text-lg font-medium tracking-tight">
                                {getDocumentName(
                                  selectedDocument,
                                )}
                              </p>

                              <p className="mt-3 text-xs font-mono text-black/35">
                                {formatFileSize(
                                  selectedDocument.file_size,
                                )}

                                {selectedDocument.word_count
                                  ? `  /  ${selectedDocument.word_count.toLocaleString()} WORDS`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDocument(null);
                              setLibraryPreviewUrl(null);
                              setResult(null);
                            }}
                            className="border border-black/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-black/45 hover:bg-white"
                          >
                            Change
                          </button>
                        </div>

                        <div className="mt-10 border-t border-black/10 pt-5">
                          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/30">
                            Ready for translation
                          </p>

                          <p className="mt-3 text-sm leading-6 text-black/55">
                            The original file will remain
                            unchanged. A translated copy
                            will be saved separately.
                          </p>
                        </div>
                      </div>

                      <div className="border border-l-0 border-black/10 bg-[#ebe9e4] p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/40">
                            Original preview
                          </p>

                          <span className="text-[9px] font-mono text-black/30">
                            PDF
                          </span>
                        </div>

                        {libraryPreviewUrl ? (
                          <iframe
                            src={libraryPreviewUrl}
                            title="Selected document preview"
                            className="h-[480px] w-full border border-black/10 bg-white"
                          />
                        ) : (
                          <div className="flex h-[480px] items-center justify-center border border-black/10 bg-white">
                            <div className="text-center">
                              <FileIcon
                                type={
                                  selectedDocument.file_type
                                }
                                large
                              />

                              <p className="mt-5 text-sm font-medium">
                                Preview unavailable
                              </p>

                              <p className="mt-2 text-xs text-black/35">
                                This document can still be
                                translated.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LIBRARY MODAL */}

              {libraryOpen &&
                sourceMode === "library" && (
                  <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
                    <div className="flex min-h-full items-center justify-center p-4">
                      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col border border-white/20 bg-[#f3f1ed] shadow-2xl">
                        <div className="flex shrink-0 items-center justify-between border-b border-black/10 bg-white px-6 py-6 lg:px-8">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/35">
                              DOCUMENT LIBRARY
                            </p>

                            <h2 className="mt-2 text-3xl font-medium tracking-[-0.03em]">
                              My Documents
                            </h2>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setLibraryOpen(false)
                            }
                            className="flex h-11 w-11 items-center justify-center border border-black/10 bg-white text-xl hover:bg-black hover:text-white"
                          >
                            ×
                          </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-8">
                          {loadingDocuments && (
                            <div className="flex min-h-[400px] items-center justify-center">
                              <div className="text-center">
                                <div className="mx-auto mb-6 h-8 w-8 animate-spin border-2 border-black/10 border-t-black" />

                                <p className="text-sm font-medium">
                                  Loading your library...
                                </p>
                              </div>
                            </div>
                          )}

                          {!loadingDocuments &&
                            documentsError && (
                              <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                                <p>
                                  {documentsError}
                                </p>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void loadDocuments()
                                  }
                                  className="mt-4 border border-red-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em]"
                                >
                                  Retry
                                </button>
                              </div>
                            )}

                          {!loadingDocuments &&
                            !documentsError &&
                            documents.length === 0 && (
                              <div className="flex min-h-[400px] items-center justify-center">
                                <div className="text-center">
                                  <div className="mx-auto flex h-16 w-16 items-center justify-center border border-black/10 bg-white text-2xl">
                                    □
                                  </div>

                                  <h3 className="mt-6 text-xl font-medium">
                                    Your library is empty
                                  </h3>

                                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-black/40">
                                    Upload your first document
                                    and it will appear here.
                                  </p>
                                </div>
                              </div>
                            )}

                          {!loadingDocuments &&
                            !documentsError &&
                            documents.length > 0 && (
                              <div className="grid gap-px border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-3">
                                {documents
                                  .filter(
                                    (document) =>
                                      document.status !==
                                      "processing",
                                  )
                                  .map((document) => (
                                    <button
                                      type="button"
                                      key={document.id}
                                      onClick={() =>
                                        handleDocumentSelect(
                                          document,
                                        )
                                      }
                                      className="group bg-white p-6 text-left transition hover:bg-[#f7f6f3]"
                                    >
                                      <div className="flex items-start justify-between">
                                        <FileIcon
                                          type={
                                            document.file_type
                                          }
                                        />

                                        <span className="text-lg text-black/20 transition group-hover:translate-x-1 group-hover:text-black">
                                          →
                                        </span>
                                      </div>

                                      <p className="mt-8 min-h-[48px] break-words text-base font-medium leading-6">
                                        {getDocumentName(
                                          document,
                                        )}
                                      </p>

                                      <div className="mt-6 flex items-center gap-3 text-[9px] font-mono uppercase tracking-[0.1em] text-black/30">
                                        <span>
                                          {formatFileSize(
                                            document.file_size,
                                          )}
                                        </span>

                                        {document.word_count ? (
                                          <>
                                            <span>
                                              /
                                            </span>

                                            <span>
                                              {document.word_count.toLocaleString()}{" "}
                                              WORDS
                                            </span>
                                          </>
                                        ) : null}
                                      </div>
                                    </button>
                                  ))}
                              </div>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center justify-between border-t border-black/10 bg-white px-6 py-4 lg:px-8">
                          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-black/30">
                            {documents.length} DOCUMENT
                            {documents.length === 1
                              ? ""
                              : "S"}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              setLibraryOpen(false)
                            }
                            className="border border-black/10 px-5 py-3 text-[9px] font-bold uppercase tracking-[0.18em] hover:bg-black hover:text-white"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* ERROR */}

              {error && (
                <div className="border-t border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* PROCESSING */}

              {translating && (
                <div className="border-t border-black/10 bg-black px-6 py-7 text-white lg:px-8">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center border border-white/20">
                      <div className="h-5 w-5 animate-spin border-2 border-white/20 border-t-white" />
                    </div>

                    <div>
                      <p className="text-lg font-medium tracking-tight">
                        {translationStage ||
                          "Processing your document..."}
                      </p>

                      <p className="mt-2 text-xs text-white/40">
                        Please keep this page open while
                        the document is being processed.
                      </p>
                    </div>

                    <div className="sm:ml-auto">
                      <div className="h-1 w-32 overflow-hidden bg-white/10">
                        <div className="h-full w-1/2 animate-pulse bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION BAR */}

              <div className="flex flex-col gap-5 border-t border-black/10 p-5 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/30">
                    Output
                  </p>

                  <p className="mt-2 text-sm text-black/55">
                    Translated copies are automatically
                    saved to My Documents.
                  </p>
                </div>

                <div className="flex gap-2">
                  {(file ||
                    selectedDocument ||
                    result) && (
                    <button
                      type="button"
                      onClick={resetTranslation}
                      disabled={translating}
                      className="border border-black/10 px-5 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-black/50 transition hover:bg-black hover:text-white disabled:opacity-30"
                    >
                      Reset
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      void handleDocumentTranslation({
                        preventDefault: () => {},
                      } as FormEvent)
                    }
                    disabled={
                      translating ||
                      (!file && !selectedDocument)
                    }
                    className="bg-black px-7 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    {translating
                      ? "Translating..."
                      : "Translate Document →"}
                  </button>
                </div>
              </div>
            </section>

            {/* RESULT */}

            {result?.success && (
              <section className="mt-6 border border-black/10 bg-white">
                <div className="flex flex-col border-b border-black/10 lg:flex-row">
                  <div className="flex flex-1 items-start gap-5 p-6 lg:p-8">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-black bg-black text-lg text-white">
                      ✓
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/35">
                        TRANSLATION COMPLETE
                      </p>

                      <h2 className="mt-2 text-2xl font-medium tracking-tight">
                        Your translated document is ready.
                      </h2>

                      <p className="mt-3 text-sm leading-6 text-black/45">
                        {result.filename ||
                          "Translated document"}
                      </p>
                    </div>
                  </div>

                  <div className="flex border-t border-black/10 lg:border-l lg:border-t-0">
                    {translatedPreviewUrl && (
                      <a
                        href={translatedPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center border-r border-black/10 px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] hover:bg-[#f3f1ed] lg:flex-none"
                      >
                        Open Preview
                      </a>
                    )}

                    {result.download_url && (
                      <a
                        href={result.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex flex-1 items-center justify-center bg-black px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:bg-black/80 lg:flex-none"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </div>

                {translatedPreviewUrl &&
                  result.filename
                    ?.toLowerCase()
                    .endsWith(".pdf") && (
                    <div className="bg-[#ebe9e4] p-5 lg:p-8">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/40">
                            TRANSLATED DOCUMENT
                          </p>

                          <p className="mt-2 text-sm font-medium">
                            {result.filename}
                          </p>
                        </div>

                        <span className="text-[9px] font-mono text-black/30">
                          {targetLanguage.toUpperCase()}
                        </span>
                      </div>

                      <iframe
                        src={translatedPreviewUrl}
                        title="Translated document preview"
                        className="h-[650px] w-full border border-black/10 bg-white"
                      />
                    </div>
                  )}

                {result.translated_text && (
                  <div className="grid lg:grid-cols-2">
                    <div className="border-b border-black/10 p-6 lg:border-b-0 lg:border-r lg:p-8">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/35">
                        TRANSLATED TEXT
                      </p>

                      <div
                        dir={
                          selectedTargetIsRTL
                            ? "rtl"
                            : "ltr"
                        }
                        className="mt-6 whitespace-pre-wrap text-lg leading-8"
                      >
                        {result.translated_text}
                      </div>
                    </div>

                    <div className="bg-[#f7f6f3] p-6 lg:p-8">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-black/35">
                        DETAILS
                      </p>

                      <dl className="mt-6 divide-y divide-black/10 border-y border-black/10">
                        <div className="flex items-center justify-between py-4">
                          <dt className="text-xs text-black/40">
                            Original
                          </dt>

                          <dd className="text-xs font-medium">
                            {sourceLanguage}
                          </dd>
                        </div>

                        <div className="flex items-center justify-between py-4">
                          <dt className="text-xs text-black/40">
                            Translation
                          </dt>

                          <dd className="text-xs font-medium">
                            {targetLanguage}
                          </dd>
                        </div>

                        <div className="flex items-center justify-between py-4">
                          <dt className="text-xs text-black/40">
                            Saved
                          </dt>

                          <dd className="text-xs font-medium">
                            {result.saved
                              ? "My Documents"
                              : "Complete"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* FOOTER INFO */}

            <div className="mt-5 flex flex-col border-t border-black/10 pt-5 text-[9px] font-bold uppercase tracking-[0.18em] text-black/30 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
              <span>
                Original remains unchanged
              </span>

              <span className="hidden sm:inline">
                /
              </span>

              <span>
                Translated copy saved separately
              </span>

              <span className="hidden sm:inline">
                /
              </span>

              <span>
                PDF + TXT supported
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}