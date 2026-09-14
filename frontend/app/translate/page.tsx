"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Russian",
  "Ukrainian",
  "Polish",
  "Turkish",
  "Greek",
  "Arabic",
  "Hebrew",
  "Persian",
  "Urdu",
  "Pashto",
  "Hindi",
  "Bengali",
  "Punjabi",
  "Gujarati",
  "Tamil",
  "Telugu",
  "Chinese",
  "Japanese",
  "Korean",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Malay",
  "Filipino",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Czech",
  "Romanian",
  "Hungarian",
  "Bulgarian",
  "Croatian",
  "Serbian",
  "Slovak",
  "Slovenian",
  "Lithuanian",
  "Latvian",
  "Estonian",
  "Swahili",
  "Afrikaans",
  "Amharic",
  "Somali",
  "Other",
];

const RTL_LANGUAGES = [
  "Arabic",
  "Hebrew",
  "Persian",
  "Farsi",
  "Urdu",
  "Pashto",
];

type LanguageSelectorProps = {
  label: string;
  value: string;
  search: string;
  setSearch: (value: string) => void;
  onChange: (value: string) => void;
  allowAutoDetect?: boolean;
};

function LanguageSelector({
  label,
  value,
  search,
  setSearch,
  onChange,
  allowAutoDetect = false,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);

  const filteredLanguages = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return LANGUAGES.filter((language) => {
      if (
        language === "Other" ||
        language === value
      ) {
        return true;
      }

      return language
        .toLowerCase()
        .includes(normalized);
    });
  }, [search, value]);

  return (
    <div className="relative">
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-full items-center justify-between border border-slate-300 bg-white px-4 text-left text-sm text-slate-900 transition hover:border-blue-500 focus:border-blue-500 focus:outline-none"
      >
        <span>{value}</span>

        <svg
          className={`h-4 w-4 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full border border-slate-300 bg-white shadow-lg">
          <div className="border-b border-slate-200 p-2">
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search language..."
              className="h-10 w-full border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {allowAutoDetect && (
              <button
                type="button"
                onClick={() => {
                  onChange("Auto Detect");
                  setOpen(false);
                  setSearch("");
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                  value === "Auto Detect"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700"
                }`}
              >
                Auto Detect
              </button>
            )}

            {filteredLanguages.map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => {
                  onChange(language);
                  setOpen(false);
                  setSearch("");
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                  value === language
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700"
                }`}
              >
                {language}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function isRtl(language: string) {
  return RTL_LANGUAGES.some(
    (item) =>
      item.toLowerCase() ===
      language.trim().toLowerCase()
  );
}

export default function TranslatePage() {
  const supabase = createClient();

  const [mode, setMode] = useState<
    "text" | "document"
  >("text");

  const [sourceLanguage, setSourceLanguage] =
    useState("Auto Detect");

  const [targetLanguage, setTargetLanguage] =
    useState("Spanish");

  const [sourceSearch, setSourceSearch] =
    useState("");

  const [targetSearch, setTargetSearch] =
    useState("");

  const [customSourceLanguage, setCustomSourceLanguage] =
    useState("");

  const [customTargetLanguage, setCustomTargetLanguage] =
    useState("");

  const [text, setText] = useState("");

  const [file, setFile] =
    useState<File | null>(null);

  const [originalPreviewUrl, setOriginalPreviewUrl] =
    useState<string | null>(null);

  const [translatedPreviewUrl, setTranslatedPreviewUrl] =
    useState<string | null>(null);

  const [translatedText, setTranslatedText] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [savedDocumentId, setSavedDocumentId] =
    useState<string | null>(null);

  const effectiveSourceLanguage =
    sourceLanguage === "Other"
      ? customSourceLanguage
      : sourceLanguage;

  const effectiveTargetLanguage =
    targetLanguage === "Other"
      ? customTargetLanguage
      : targetLanguage;

  const targetIsRtl = isRtl(
    effectiveTargetLanguage
  );

  useEffect(() => {
    return () => {
      if (originalPreviewUrl) {
        URL.revokeObjectURL(
          originalPreviewUrl
        );
      }
    };
  }, [originalPreviewUrl]);

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile =
      event.target.files?.[0] || null;

    setFile(selectedFile);
    setError("");
    setSuccess("");
    setTranslatedPreviewUrl(null);
    setSavedDocumentId(null);

    if (originalPreviewUrl) {
      URL.revokeObjectURL(
        originalPreviewUrl
      );
      setOriginalPreviewUrl(null);
    }

    if (
      selectedFile &&
      selectedFile.type ===
        "application/pdf"
    ) {
      const url =
        URL.createObjectURL(
          selectedFile
        );

      setOriginalPreviewUrl(url);
    }
  };

  const validateLanguages = () => {
    if (
      sourceLanguage === "Other" &&
      !customSourceLanguage.trim()
    ) {
      setError(
        "Please enter your custom source language."
      );

      return false;
    }

    if (
      targetLanguage === "Other" &&
      !customTargetLanguage.trim()
    ) {
      setError(
        "Please enter your custom target language."
      );

      return false;
    }

    if (!effectiveTargetLanguage.trim()) {
      setError(
        "Please select a target language."
      );

      return false;
    }

    return true;
  };

  const getAccessToken = async () => {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(
        "Unable to retrieve your session."
      );
    }

    const accessToken =
      sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error(
        "Please sign in before using translation."
      );
    }

    return accessToken;
  };

  const handleTextTranslation = async () => {
    if (!text.trim()) {
      setError(
        "Enter some text to translate."
      );

      return;
    }

    const accessToken =
      await getAccessToken();

    const formData = new FormData();

    formData.append(
      "text",
      text
    );

    formData.append(
      "source_language",
      effectiveSourceLanguage
    );

    formData.append(
      "target_language",
      effectiveTargetLanguage
    );

    const response = await fetch(
      `${API_BASE_URL}/api/translate/text`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail ||
          "Translation failed."
      );
    }

    setTranslatedText(
      data.translated_text || ""
    );

    setSuccess(
      "Translation completed successfully."
    );
  };

  const handleDocumentTranslation =
    async () => {
      if (!file) {
        setError(
          "Please upload a document first."
        );

        return;
      }

      const accessToken =
        await getAccessToken();

      const formData = new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "source_language",
        effectiveSourceLanguage
      );

      formData.append(
        "target_language",
        effectiveTargetLanguage
      );

      formData.append(
        "save_to_account",
        "true"
      );

      const response = await fetch(
        `${API_BASE_URL}/api/translate/document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Document translation failed."
        );
      }

      setTranslatedPreviewUrl(
        data.preview_url || null
      );

      setSavedDocumentId(
        data.document_id || null
      );

      setSuccess(
        "Document translated and saved to My Documents."
      );
    };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!validateLanguages()) {
        return;
      }

      if (mode === "text") {
        await handleTextTranslation();
      } else {
        await handleDocumentTranslation();
      }
    } catch (translationError) {
      console.error(
        translationError
      );

      setError(
        translationError instanceof Error
          ? translationError.message
          : "Translation failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Link
        href="/dashboard"
        className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900"
        >
           ← Back to Dashboard
      </Link>
      <main className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
    
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
              AI Tools
            </div>

            <h1 className="text-3xl font-semibold tracking-tight">
              Translate
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Translate text and documents while
              preserving structure, formatting,
              and visual hierarchy.
            </p>
          </div>

          <Link
            href="/documents"
            className="inline-flex h-10 items-center justify-center border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-600"
          >
            My Documents
          </Link>
        </div>

        <div className="mb-6 flex border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => {
              setMode("text");
              setError("");
              setSuccess("");
            }}
            className={`flex-1 border-r border-slate-300 px-5 py-3 text-sm font-medium transition md:flex-none md:min-w-[190px] ${
              mode === "text"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Text Translation
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("document");
              setError("");
              setSuccess("");
            }}
            className={`flex-1 px-5 py-3 text-sm font-medium transition md:flex-none md:min-w-[210px] ${
              mode === "document"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Document Translation
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <section className="border border-slate-300 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                Translation Settings
              </h2>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <LanguageSelector
                  label="Source Language"
                  value={sourceLanguage}
                  search={sourceSearch}
                  setSearch={setSourceSearch}
                  onChange={setSourceLanguage}
                  allowAutoDetect
                />

                {sourceLanguage ===
                  "Other" && (
                  <input
                    type="text"
                    value={
                      customSourceLanguage
                    }
                    onChange={(event) =>
                      setCustomSourceLanguage(
                        event.target.value
                      )
                    }
                    placeholder="Enter source language"
                    className="mt-3 h-11 w-full border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-500"
                  />
                )}
              </div>

              <div>
                <LanguageSelector
                  label="Target Language"
                  value={targetLanguage}
                  search={targetSearch}
                  setSearch={setTargetSearch}
                  onChange={setTargetLanguage}
                />

                {targetLanguage ===
                  "Other" && (
                  <input
                    type="text"
                    value={
                      customTargetLanguage
                    }
                    onChange={(event) =>
                      setCustomTargetLanguage(
                        event.target.value
                      )
                    }
                    placeholder="Enter target language"
                    className="mt-3 h-11 w-full border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-500"
                  />
                )}
              </div>
            </div>
          </section>

          {mode === "text" ? (
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="border border-slate-300 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Original
                    </div>

                    <div className="mt-1 text-sm font-medium">
                      {effectiveSourceLanguage}
                    </div>
                  </div>

                  <div className="text-xs text-slate-400">
                    {text.length} characters
                  </div>
                </div>

                <textarea
                  value={text}
                  onChange={(event) =>
                    setText(
                      event.target.value
                    )
                  }
                  placeholder="Enter the text you want to translate..."
                  className="min-h-[420px] w-full resize-none border-0 bg-white p-5 text-sm leading-7 outline-none"
                  dir={
                    isRtl(
                      effectiveSourceLanguage
                    )
                      ? "rtl"
                      : "ltr"
                  }
                />
              </div>

              <div className="border border-slate-300 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Translation
                    </div>

                    <div className="mt-1 text-sm font-medium">
                      {effectiveTargetLanguage}
                    </div>
                  </div>

                  <div className="text-xs text-blue-600">
                    AI Translation
                  </div>
                </div>

                <textarea
                  value={translatedText}
                  readOnly
                  placeholder="Your translated text will appear here..."
                  className="min-h-[420px] w-full resize-none border-0 bg-slate-50 p-5 text-sm leading-7 outline-none"
                  dir={
                    targetIsRtl
                      ? "rtl"
                      : "ltr"
                  }
                />
              </div>
            </section>
          ) : (
            <>
              <section className="border border-slate-300 bg-white">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Upload Document
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    PDF is currently the primary
                    format for visual document
                    translation.
                  </p>
                </div>

                <div className="p-6">
                  <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-blue-500 hover:bg-blue-50/30">
                    <svg
                      className="mb-4 h-8 w-8 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M12 16V4"
                        strokeLinecap="square"
                      />

                      <path
                        d="M7 9l5-5 5 5"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />

                      <path
                        d="M5 20h14"
                        strokeLinecap="square"
                      />
                    </svg>

                    <span className="text-sm font-medium text-slate-700">
                      {file
                        ? file.name
                        : "Choose a document"}
                    </span>

                    <span className="mt-2 text-xs text-slate-400">
                      PDF, DOCX, or TXT
                    </span>

                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={
                        handleFileChange
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </section>

              {(originalPreviewUrl ||
                translatedPreviewUrl) && (
                <section className="grid gap-5 lg:grid-cols-2">
                  <div className="border border-slate-300 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Original
                        </div>

                        <div className="mt-1 text-sm font-medium">
                          {file?.name}
                        </div>
                      </div>

                      <div className="text-xs text-slate-400">
                        {effectiveSourceLanguage}
                      </div>
                    </div>

                    <div className="h-[720px] bg-slate-100">
                      {originalPreviewUrl ? (
                        <iframe
                          src={
                            originalPreviewUrl
                          }
                          title="Original document preview"
                          className="h-full w-full border-0"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          Preview unavailable
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-300 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Translated
                        </div>

                        <div className="mt-1 text-sm font-medium">
                          {effectiveTargetLanguage}
                        </div>
                      </div>

                      {translatedPreviewUrl && (
                        <a
                          href={
                            translatedPreviewUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Open
                        </a>
                      )}
                    </div>

                    <div
                      className="h-[720px] bg-slate-100"
                      dir={
                        targetIsRtl
                          ? "rtl"
                          : "ltr"
                      }
                    >
                      {translatedPreviewUrl ? (
                        <iframe
                          src={
                            translatedPreviewUrl
                          }
                          title="Translated document preview"
                          className="h-full w-full border-0"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                          <div className="text-sm font-medium text-slate-500">
                            Translated document
                          </div>

                          <div className="mt-2 max-w-sm text-xs leading-5 text-slate-400">
                            Your translated document
                            will appear here after
                            processing.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {error && (
            <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
              {success}

              {savedDocumentId && (
                <span className="ml-2">
                  Document ID:{" "}
                  {savedDocumentId}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs leading-5 text-slate-500">
              Translated documents are saved to
              your account and can appear in My
              Documents.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 min-w-[190px] items-center justify-center bg-blue-600 px-7 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="2"
                      opacity="0.3"
                    />

                    <path
                      d="M21 12a9 9 0 0 0-9-9"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>

                  Translating...
                </>
              ) : mode === "text" ? (
                "Translate Text"
              ) : (
                "Translate Document"
              )}
            </button>
          </div>

          {translatedPreviewUrl &&
            mode === "document" && (
              <div className="border border-slate-300 bg-white p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Translation Ready
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Your translated document has
                      been saved to your account.
                    </div>
                  </div>

                  <a
                    href={
                      translatedPreviewUrl
                    }
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-600"
                  >
                    Download Translation
                  </a>
                </div>
              </div>
            )}
        </form>
      </main>
    </div>
  );
}