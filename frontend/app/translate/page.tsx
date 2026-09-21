"use client";

import React, {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

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
  return (
    document.file_name ||
    document.name ||
    "Untitled document"
  );
}

function getFriendlyError(
  response: Response,
  data: any,
): string {
  if (response.status === 503) {
    return (
      "Translation is temporarily unavailable. " +
      "Please try again shortly."
    );
  }

  if (response.status === 502) {
    return (
      "We couldn't complete this translation. " +
      "Your original document was not changed."
    );
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

  return (
    "Something went wrong while translating your document. " +
    "Please try again."
  );
}

export default function TranslatePage() {
  const [mode, setMode] = useState<
    "text" | "document"
  >("document");

  const [sourceLanguage, setSourceLanguage] =
    useState("English");

  const [targetLanguage, setTargetLanguage] =
    useState("Amharic");

  const [text, setText] = useState("");

  const [file, setFile] =
    useState<File | null>(null);

  const [selectedDocument, setSelectedDocument] =
    useState<DocumentItem | null>(null);

  const [documents, setDocuments] =
    useState<DocumentItem[]>([]);

  const [loadingDocuments, setLoadingDocuments] =
    useState(false);

  const [documentsError, setDocumentsError] =
    useState("");

  const [sourceMode, setSourceMode] = useState<
    "upload" | "library"
  >("upload");

  const [translating, setTranslating] =
    useState(false);

  const [translationStage, setTranslationStage] =
    useState("");

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState<TranslationResult | null>(null);

  const [localPreviewUrl, setLocalPreviewUrl] =
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

  // ==========================================================
  // AUTH
  // ==========================================================

  async function getAccessToken(): Promise<string> {
    const supabaseModule =
      await import("@/lib/supabase");

    const supabase =
      supabaseModule.supabase;

    const {
      data,
      error: sessionError,
    } =
      await supabase.auth.getSession();

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

  // ==========================================================
  // LOAD MY DOCUMENTS
  // ==========================================================

  async function loadDocuments() {
    setLoadingDocuments(true);
    setDocumentsError("");

    try {
      const token =
        await getAccessToken();

      /*
       * The existing upload router owns the document
       * authorization. We intentionally do not query
       * Supabase directly from the browser for another
       * user's documents.
       *
       * The route below should return only the authenticated
       * user's documents.
       */
      const response = await fetch(
        `${API_BASE_URL}/upload/documents`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data =
        await response.json().catch(
          () => ({}),
        );

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to load your documents.",
        );
      }

      const items =
        Array.isArray(data)
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

  // ==========================================================
  // LOAD LIBRARY WHEN OPENED
  // ==========================================================

  useEffect(() => {
    if (
      mode === "document" &&
      sourceMode === "library" &&
      libraryOpen
    ) {
      loadDocuments();
    }
  }, [
    mode,
    sourceMode,
    libraryOpen,
  ]);

  // ==========================================================
  // CLEAN LOCAL PREVIEW URL
  // ==========================================================

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(
          localPreviewUrl,
        );
      }
    };
  }, [localPreviewUrl]);

  // ==========================================================
  // FILE SELECTION
  // ==========================================================

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selected =
      event.target.files?.[0] || null;

    setError("");
    setResult(null);
    setSelectedDocument(null);

    if (localPreviewUrl) {
      URL.revokeObjectURL(
        localPreviewUrl,
      );
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
      !["pdf", "txt"].includes(
        extension,
      )
    ) {
      setFile(null);

      setError(
        "Please select a PDF or TXT document.",
      );

      event.target.value = "";
      return;
    }

    setFile(selected);

    if (
      extension === "pdf"
    ) {
      setLocalPreviewUrl(
        URL.createObjectURL(
          selected,
        ),
      );
    }
  }

  // ==========================================================
  // SELECT EXISTING DOCUMENT
  // ==========================================================

  function handleDocumentSelect(
    document: DocumentItem,
  ) {
    setSelectedDocument(
      document,
    );

    setFile(null);
    setResult(null);
    setError("");
    setLibraryOpen(false);

    if (localPreviewUrl) {
      URL.revokeObjectURL(
        localPreviewUrl,
      );

      setLocalPreviewUrl(null);
    }
  }

  // ==========================================================
  // SWITCH SOURCE MODE
  // ==========================================================

  function changeSourceMode(
    nextMode: "upload" | "library",
  ) {
    setSourceMode(nextMode);
    setError("");
    setResult(null);

    if (nextMode === "upload") {
      setSelectedDocument(null);
      setLibraryOpen(false);
    } else {
      setFile(null);

      if (localPreviewUrl) {
        URL.revokeObjectURL(
          localPreviewUrl,
        );

        setLocalPreviewUrl(null);
      }

      setLibraryOpen(true);
    }
  }

  // ==========================================================
  // TRANSLATE TEXT
  // ==========================================================

  async function handleTextTranslation(
    event: FormEvent,
  ) {
    event.preventDefault();

    setError("");
    setResult(null);

    if (!text.trim()) {
      setError(
        "Please enter text to translate.",
      );
      return;
    }

    if (
      sourceLanguage ===
      targetLanguage
    ) {
      setError(
        "Choose two different languages.",
      );
      return;
    }

    setTranslating(true);
    setTranslationStage(
      "Translating your text…",
    );

    try {
      const token =
        await getAccessToken();

      const formData =
        new FormData();

      formData.append(
        "text",
        text,
      );

      formData.append(
        "source_language",
        sourceLanguage,
      );

      formData.append(
        "target_language",
        targetLanguage,
      );

      const response =
        await fetch(
          `${API_BASE_URL}/translate/text`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          },
        );

      const data =
        await response.json().catch(
          () => ({}),
        );

      if (!response.ok) {
        throw new Error(
          getFriendlyError(
            response,
            data,
          ),
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

  // ==========================================================
  // TRANSLATE DOCUMENT
  // ==========================================================

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

    if (
      file &&
      selectedDocument
    ) {
      setError(
        "Choose either an uploaded document or a document from your library.",
      );
      return;
    }

    if (
      sourceLanguage ===
      targetLanguage
    ) {
      setError(
        "Choose two different languages.",
      );
      return;
    }

    setTranslating(true);
    setTranslationStage(
      "Preparing your document…",
    );

    try {
      const token =
        await getAccessToken();

      const formData =
        new FormData();

      if (file) {
        formData.append(
          "file",
          file,
        );
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
        "Translating your document…",
      );

      const response =
        await fetch(
          `${API_BASE_URL}/translate/document`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          },
        );

      const data =
        await response.json().catch(
          () => ({}),
        );

      if (!response.ok) {
        throw new Error(
          getFriendlyError(
            response,
            data,
          ),
        );
      }

      setTranslationStage(
        "Saving your translated document…",
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

  // ==========================================================
  // RESET
  // ==========================================================

  function resetTranslation() {
    setFile(null);
    setSelectedDocument(null);
    setResult(null);
    setError("");
    setTranslationStage("");

    if (localPreviewUrl) {
      URL.revokeObjectURL(
        localPreviewUrl,
      );

      setLocalPreviewUrl(null);
    }
  }

  // ==========================================================
  // DOCUMENT PREVIEW
  // ==========================================================

  const originalPreviewUrl =
    selectedDocument
      ? `${API_BASE_URL}/upload/${selectedDocument.id}/preview`
      : localPreviewUrl;

  const translatedPreviewUrl =
    result?.preview_url ||
    result?.download_url ||
    null;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="min-h-screen bg-[#f7f0f6] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            AI Document Translation
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Translate with confidence.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Translate text and documents while preserving
            the structure and visual character of your
            original file.
          </p>
        </div>

        {/* ================================================== */}
        {/* MODE SWITCH */}
        {/* ================================================== */}

        <div className="mb-6 inline-flex rounded-2xl border border-white/80 bg-white/70 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setMode("document");
              setError("");
              setResult(null);
            }}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
              mode === "document"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Document Translation
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("text");
              setError("");
              setResult(null);
            }}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
              mode === "text"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Text Translation
          </button>
        </div>

        {/* ================================================== */}
        {/* MAIN CARD */}
        {/* ================================================== */}

        <div className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_20px_70px_rgba(60,35,60,0.08)] backdrop-blur-xl sm:p-7">
          {/* ================================================= */}
          {/* LANGUAGE CONTROLS */}
          {/* ================================================= */}

          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                From
              </label>

              <select
                value={sourceLanguage}
                onChange={(event) =>
                  setSourceLanguage(
                    event.target.value,
                  )
                }
                disabled={translating}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
                dir={
                  selectedSourceIsRTL
                    ? "rtl"
                    : "ltr"
                }
              >
                {LANGUAGES.map(
                  (language) => (
                    <option
                      key={language.code}
                      value={
                        language.code
                      }
                    >
                      {language.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 md:flex">
              →
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                To
              </label>

              <select
                value={targetLanguage}
                onChange={(event) =>
                  setTargetLanguage(
                    event.target.value,
                  )
                }
                disabled={translating}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
                dir={
                  selectedTargetIsRTL
                    ? "rtl"
                    : "ltr"
                }
              >
                {LANGUAGES.map(
                  (language) => (
                    <option
                      key={language.code}
                      value={
                        language.code
                      }
                    >
                      {language.name}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          {/* ================================================= */}
          {/* TEXT MODE */}
          {/* ================================================= */}

          {mode === "text" && (
            <form
              onSubmit={
                handleTextTranslation
              }
              className="mt-7"
            >
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Text
              </label>

              <textarea
                value={text}
                onChange={(event) =>
                  setText(
                    event.target.value,
                  )
                }
                placeholder="Enter or paste the text you want to translate…"
                disabled={translating}
                dir={
                  selectedSourceIsRTL
                    ? "rtl"
                    : "ltr"
                }
                className="min-h-[280px] w-full resize-y rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
              />

              {error && (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between gap-4">
                <span className="text-xs text-slate-400">
                  {text.length.toLocaleString()} characters
                </span>

                <button
                  type="submit"
                  disabled={
                    translating ||
                    !text.trim()
                  }
                  className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {translating
                    ? "Translating…"
                    : "Translate Text"}
                </button>
              </div>
            </form>
          )}

          {/* ================================================= */}
          {/* DOCUMENT MODE */}
          {/* ================================================= */}

          {mode === "document" && (
            <div className="mt-7">
              {/* ============================================= */}
              {/* SOURCE SELECTOR */}
              {/* ============================================= */}

              <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100/80 p-1">
                <button
                  type="button"
                  disabled={translating}
                  onClick={() =>
                    changeSourceMode(
                      "upload",
                    )
                  }
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    sourceMode ===
                    "upload"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Upload Document
                </button>

                <button
                  type="button"
                  disabled={translating}
                  onClick={() =>
                    changeSourceMode(
                      "library",
                    )
                  }
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    sourceMode ===
                    "library"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  My Documents
                </button>
              </div>

              {/* ============================================= */}
              {/* UPLOAD */}
              {/* ============================================= */}

              {sourceMode ===
                "upload" && (
                <div>
                  <label
                    htmlFor="document-upload"
                    className={`group flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-6 text-center transition hover:border-slate-400 hover:bg-white ${
                      translating
                        ? "pointer-events-none opacity-60"
                        : ""
                    }`}
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl transition group-hover:scale-105">
                      ↑
                    </div>

                    <p className="text-sm font-semibold text-slate-800">
                      {file
                        ? file.name
                        : "Choose a document"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      PDF or TXT
                    </p>

                    {file && (
                      <p className="mt-2 text-xs text-slate-400">
                        {formatFileSize(
                          file.size,
                        )}
                      </p>
                    )}

                    <input
                      id="document-upload"
                      type="file"
                      accept=".pdf,.txt,application/pdf,text/plain"
                      onChange={
                        handleFileChange
                      }
                      className="hidden"
                      disabled={
                        translating
                      }
                    />
                  </label>
                </div>
              )}

              {/* ============================================= */}
              {/* LIBRARY */}
              {/* ============================================= */}

              {sourceMode ===
                "library" && (
                <div>
                  {!selectedDocument && (
                    <button
                      type="button"
                      onClick={() =>
                        setLibraryOpen(
                          true,
                        )
                      }
                      disabled={
                        translating
                      }
                      className="flex min-h-[190px] w-full flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white/70 px-6 text-center transition hover:border-slate-300 hover:bg-white disabled:opacity-60"
                    >
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5e9f1] text-xl">
                        ▣
                      </div>

                      <p className="text-sm font-semibold text-slate-800">
                        Select from My Documents
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Choose a document you've already uploaded
                      </p>
                    </button>
                  )}

                  {selectedDocument && (
                    <div className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-5">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xs font-bold uppercase text-slate-500">
                          {selectedDocument.file_type?.includes(
                            "pdf",
                          )
                            ? "PDF"
                            : "TXT"}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {getDocumentName(
                              selectedDocument,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {formatFileSize(
                              selectedDocument.file_size,
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocument(
                            null,
                          );
                          setResult(null);
                        }}
                        disabled={
                          translating
                        }
                        className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================= */}
              {/* DOCUMENT LIBRARY MODAL */}
              {/* ============================================= */}

              {libraryOpen &&
                sourceMode ===
                  "library" && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
                    <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-2xl">
                      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">
                            My Documents
                          </h2>

                          <p className="mt-1 text-xs text-slate-400">
                            Select the document you want to translate.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setLibraryOpen(
                              false,
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          ×
                        </button>
                      </div>

                      <div className="max-h-[55vh] overflow-y-auto p-4">
                        {loadingDocuments && (
                          <div className="py-12 text-center">
                            <div className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />

                            <p className="text-sm text-slate-500">
                              Loading your documents…
                            </p>
                          </div>
                        )}

                        {!loadingDocuments &&
                          documentsError && (
                            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                              {
                                documentsError
                              }

                              <button
                                type="button"
                                onClick={
                                  loadDocuments
                                }
                                className="ml-2 font-semibold underline"
                              >
                                Retry
                              </button>
                            </div>
                          )}

                        {!loadingDocuments &&
                          !documentsError &&
                          documents.length ===
                            0 && (
                            <div className="py-12 text-center">
                              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                                ▣
                              </div>

                              <p className="text-sm font-semibold text-slate-800">
                                No documents yet
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                Upload a document first, then you'll be able to select it here.
                              </p>
                            </div>
                          )}

                        {!loadingDocuments &&
                          !documentsError &&
                          documents.length >
                            0 && (
                            <div className="space-y-2">
                              {documents
                                .filter(
                                  (
                                    document,
                                  ) =>
                                    document.status !==
                                    "processing",
                                )
                                .map(
                                  (
                                    document,
                                  ) => (
                                    <button
                                      type="button"
                                      key={
                                        document.id
                                      }
                                      onClick={() =>
                                        handleDocumentSelect(
                                          document,
                                        )
                                      }
                                      className="flex w-full items-center gap-4 rounded-2xl border border-transparent p-4 text-left transition hover:border-slate-200 hover:bg-slate-50"
                                    >
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                                        {document.file_type?.includes(
                                          "pdf",
                                        )
                                          ? "PDF"
                                          : "TXT"}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-800">
                                          {getDocumentName(
                                            document,
                                          )}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-400">
                                          {formatFileSize(
                                            document.file_size,
                                          )}

                                          {document.word_count
                                            ? ` · ${document.word_count.toLocaleString()} words`
                                            : ""}
                                        </p>
                                      </div>

                                      <span className="text-slate-300">
                                        →
                                      </span>
                                    </button>
                                  ),
                                )}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}

              {/* ============================================= */}
              {/* ORIGINAL PREVIEW */}
              {/* ============================================= */}

              {(file ||
                selectedDocument) && (
                <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Original
                      </p>

                      <p className="mt-1 max-w-[300px] truncate text-sm font-medium text-slate-700">
                        {file
                          ? file.name
                          : selectedDocument
                            ? getDocumentName(
                                selectedDocument,
                              )
                            : ""}
                      </p>
                    </div>
                  </div>

                  {originalPreviewUrl &&
                    (
                      file?.name
                        .toLowerCase()
                        .endsWith(".pdf") ||
                      selectedDocument?.file_type?.includes(
                        "pdf",
                      )
                    ) && (
                      <iframe
                        src={
                          originalPreviewUrl
                        }
                        title="Original document preview"
                        className="h-[420px] w-full bg-slate-100"
                      />
                    )}

                  {file &&
                    file.name
                      .toLowerCase()
                      .endsWith(
                        ".txt",
                      ) && (
                      <div className="p-6">
                        <p className="text-xs text-slate-400">
                          Text document ready for translation.
                        </p>
                      </div>
                    )}
                </div>
              )}

              {/* ============================================= */}
              {/* ERROR */}
              {/* ============================================= */}

              {error && (
                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* ============================================= */}
              {/* TRANSLATION STATE */}
              {/* ============================================= */}

              {translating && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />

                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {translationStage ||
                          "Working on your document…"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Please keep this page open while the document is being processed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================= */}
              {/* TRANSLATE BUTTON */}
              {/* ============================================= */}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-400">
                  Your translated document will be saved
                  to My Documents automatically.
                </p>

                <div className="flex gap-2">
                  {(file ||
                    selectedDocument ||
                    result) && (
                    <button
                      type="button"
                      onClick={
                        resetTranslation
                      }
                      disabled={
                        translating
                      }
                      className="rounded-2xl px-5 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                    >
                      Reset
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={
                      handleDocumentTranslation as any
                    }
                    disabled={
                      translating ||
                      (!file &&
                        !selectedDocument)
                    }
                    className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {translating
                      ? "Translating…"
                      : "Translate Document"}
                  </button>
                </div>
              </div>

              {/* ============================================= */}
              {/* RESULT */}
              {/* ============================================= */}

              {result?.success && (
                <div className="mt-7 overflow-hidden rounded-[24px] border border-emerald-100 bg-emerald-50/60">
                  <div className="flex flex-col gap-4 border-b border-emerald-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        ✓
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Translation complete
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Your translated document has been saved to My Documents.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {translatedPreviewUrl && (
                        <a
                          href={
                            translatedPreviewUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                        >
                          Preview
                        </a>
                      )}

                      {result.download_url && (
                        <a
                          href={
                            result.download_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>

                  {translatedPreviewUrl &&
                    result.filename
                      ?.toLowerCase()
                      .endsWith(
                        ".pdf",
                      ) && (
                      <iframe
                        src={
                          translatedPreviewUrl
                        }
                        title="Translated document preview"
                        className="h-[500px] w-full bg-white"
                      />
                    )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================== */}
        {/* FOOTER TRUST NOTE */}
        {/* ================================================== */}

        {mode === "document" && (
          <div className="mt-5 flex flex-col gap-2 text-center text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-center sm:gap-5">
            <span>
              Original document remains unchanged
            </span>

            <span className="hidden sm:inline">
              •
            </span>

            <span>
              Translated copy saved separately
            </span>

            <span className="hidden sm:inline">
              •
            </span>

            <span>
              PDF and TXT supported
            </span>
          </div>
        )}
      </div>
    </div>
  );
}