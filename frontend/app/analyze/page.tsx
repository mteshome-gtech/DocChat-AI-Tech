"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { hasFeature, type Plan } from "@/lib/plans";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type AnalyzeType = {
  id: string;
  name: string;
  description: string;
  category: "Quick" | "Review" | "Business" | "Advanced";
};

type UploadedDocument = {
  id: string;
  name: string;
  file: File;
  status: "ready" | "uploading" | "error";
};

type SavedDocument = {
  id: string;
  name: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string | null;
  created_at: string;
};

const ANALYSIS_TYPES: AnalyzeType[] = [
  {
    id: "executive_summary",
    name: "Executive Summary",
    description:
      "Get a concise overview of the most important information.",
    category: "Quick",
  },
  {
    id: "key_findings",
    name: "Key Findings",
    description:
      "Identify the most important findings and insights.",
    category: "Quick",
  },
  {
    id: "detailed_summary",
    name: "Detailed Summary",
    description:
      "Generate a deeper structured summary of the document.",
    category: "Quick",
  },
  {
    id: "risks",
    name: "Risks & Red Flags",
    description:
      "Identify potential risks, warnings, and concerns.",
    category: "Review",
  },
  {
    id: "obligations",
    name: "Obligations",
    description:
      "Find responsibilities, requirements, and commitments.",
    category: "Review",
  },
  {
    id: "important_dates",
    name: "Important Dates",
    description:
      "Extract deadlines, dates, renewals, and time-sensitive events.",
    category: "Review",
  },
  {
    id: "contradictions",
    name: "Contradictions",
    description:
      "Find inconsistencies or conflicting information.",
    category: "Review",
  },
  {
    id: "missing_information",
    name: "Missing Information",
    description:
      "Identify important information that may be missing.",
    category: "Review",
  },
  {
    id: "legal_review",
    name: "Legal & Contract Review",
    description:
      "Review contracts for important legal language and clauses.",
    category: "Review",
  },
  {
    id: "compliance",
    name: "Compliance & Requirements",
    description:
      "Identify requirements, standards, and compliance issues.",
    category: "Review",
  },
  {
    id: "financial",
    name: "Financial Analysis",
    description:
      "Extract and analyze financial information and implications.",
    category: "Business",
  },
  {
    id: "opportunities",
    name: "Opportunities",
    description:
      "Identify potential opportunities and areas for improvement.",
    category: "Business",
  },
  {
    id: "strengths_weaknesses",
    name: "Strengths & Weaknesses",
    description:
      "Evaluate strengths, weaknesses, and potential gaps.",
    category: "Business",
  },
  {
    id: "recommendations",
    name: "Recommendations",
    description:
      "Generate practical recommendations based on the document.",
    category: "Business",
  },
  {
    id: "action_items",
    name: "Action Items",
    description:
      "Turn the document into a clear list of next steps.",
    category: "Business",
  },
  {
    id: "entities",
    name: "Key Entities & People",
    description:
      "Identify important people, organizations, products, and entities.",
    category: "Business",
  },
  {
    id: "custom",
    name: "Custom Analysis",
    description:
      "Ask Gemini to analyze the document however you want.",
    category: "Advanced",
  },
];

export default function AnalyzePage() {
  const supabase = createClient();

  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);
  const [analysisId, setAnalysisId] =
    useState("executive_summary");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [document, setDocument] = useState("");
  const [uploadedDocuments, setUploadedDocuments] =
    useState<UploadedDocument[]>([]);
  const [savedDocuments, setSavedDocuments] =
    useState<SavedDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] =
    useState(true);
  const [selectedDocumentId, setSelectedDocumentId] =
    useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        setLoadingDocuments(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      const userPlan: Plan =
        profile?.plan === "pro" ? "pro" : "free";

      setPlan(userPlan);

      const {
        data: documentsData,
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
          "Documents loading error:",
          documentsError
        );

        setError(
          "Unable to load your saved documents."
        );
      } else {
        setSavedDocuments(documentsData || []);
      }

      setLoading(false);
      setLoadingDocuments(false);
    }

    load();
  }, []);

  const selectedAnalysis =
    ANALYSIS_TYPES.find(
      (item) => item.id === analysisId
    ) || ANALYSIS_TYPES[0];

  const filteredAnalysisTypes = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return ANALYSIS_TYPES;
    }

    return ANALYSIS_TYPES.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description
          .toLowerCase()
          .includes(query) ||
        item.category
          .toLowerCase()
          .includes(query)
    );
  }, [search]);

  const groupedAnalysisTypes = {
    Quick: filteredAnalysisTypes.filter(
      (item) => item.category === "Quick"
    ),
    Review: filteredAnalysisTypes.filter(
      (item) => item.category === "Review"
    ),
    Business: filteredAnalysisTypes.filter(
      (item) => item.category === "Business"
    ),
    Advanced: filteredAnalysisTypes.filter(
      (item) => item.category === "Advanced"
    ),
  };

  const quickTypes = ANALYSIS_TYPES.filter(
    (item) => item.category === "Quick"
  ).slice(0, 4);

  if (loading) {
    return <PageLoading />;
  }

  if (!hasFeature(plan, "analyze")) {
    return (
      <UpgradeState
        title="Deep document intelligence"
        description="Analyze documents for key findings, risks, obligations, dates, and action items."
        plan="Pro"
      />
    );
  }

  function selectAnalysis(id: string) {
    setAnalysisId(id);
    setAnalysisOpen(false);
    setSearch("");
    setResult("");
    setError("");
  }

  function getFileExtension(fileName: string) {
    const extension =
      fileName
        .split(".")
        .pop()
        ?.toUpperCase() || "DOC";

    if (extension === "PDF") return "PDF";
    if (extension === "DOCX") return "DOC";
    if (extension === "TXT") return "TXT";

    return "DOC";
  }

  function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) return;

    setError("");
    setSelectedDocumentId("");
    setDocument("uploaded");

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    const validFiles = files.filter((file) =>
      validTypes.includes(file.type)
    );

    if (validFiles.length !== files.length) {
      setError(
        "Please upload only PDF, DOCX, or TXT files."
      );
    }

    const newDocuments: UploadedDocument[] =
      validFiles.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        name: file.name,
        file,
        status: "ready",
      }));

    setUploadedDocuments((current) => [
      ...current,
      ...newDocuments,
    ]);

    event.target.value = "";
  }

  async function handleSavedDocumentSelect(
    documentId: string
  ) {
    setError("");
    setResult("");

    if (!documentId) {
      setSelectedDocumentId("");
      setDocument("");
      return;
    }

    const savedDocument =
      savedDocuments.find(
        (item) => item.id === documentId
      );

    if (!savedDocument) {
      setError(
        "The selected document could not be found."
      );
      return;
    }

    setSelectedDocumentId(documentId);
    setDocument("documents");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "You must be signed in to select documents."
        );
      }

      /*
       * IMPORTANT:
       * This is the saved-document preview endpoint.
       * We are only changing the API host here.
       * We are NOT changing /upload/.../preview to /api/upload/...
       * until that backend route is confirmed.
       */
      const response = await fetch(
        `${API_URL}/upload/${documentId}/preview`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to retrieve the selected document."
        );
      }

      const previewData = await response.json();

      if (!previewData?.url) {
        throw new Error(
          "No document file was found."
        );
      }

      const fileResponse =
        await fetch(previewData.url);

      if (!fileResponse.ok) {
        throw new Error(
          "Unable to download the selected document."
        );
      }

      const blob = await fileResponse.blob();

      const file = new File(
        [blob],
        savedDocument.file_name ||
          savedDocument.name,
        {
          type:
            savedDocument.file_type ||
            blob.type ||
            "application/octet-stream",
        }
      );

      const selectedFile: UploadedDocument = {
        id: savedDocument.id,
        name:
          savedDocument.file_name ||
          savedDocument.name,
        file,
        status: "ready",
      };

      setUploadedDocuments((current) => {
        const withoutExisting =
          current.filter(
            (item) =>
              item.id !== savedDocument.id
          );

        return [
          ...withoutExisting,
          selectedFile,
        ];
      });
    } catch (err) {
      console.error(
        "Saved document selection error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the selected document."
      );

      setSelectedDocumentId("");
      setDocument("");
    }
  }

  function removeDocument(id: string) {
    setUploadedDocuments((current) =>
      current.filter(
        (item) => item.id !== id
      )
    );

    if (selectedDocumentId === id) {
      setSelectedDocumentId("");
      setDocument("");
    }
  }

  async function handleAnalyze() {
    setError("");
    setResult("");

    if (!uploadedDocuments.length) {
      setError(
        "Please select or upload at least one document."
      );
      return;
    }

    if (
      selectedAnalysis.id === "custom" &&
      !customPrompt.trim()
    ) {
      setError(
        "Enter an instruction for your custom analysis."
      );
      return;
    }

    setAnalyzing(true);

    try {
      const formData = new FormData();

      formData.append(
        "analysis_type",
        selectedAnalysis.id
      );

      if (selectedAnalysis.id === "custom") {
        formData.append(
          "custom_prompt",
          customPrompt
        );
      }

      uploadedDocuments.forEach((document) => {
        formData.append(
          "files",
          document.file
        );
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "You must be signed in to analyze documents."
        );
      }

      /*
       * PRODUCTION FIX:
       * Use the configured API URL instead of localhost.
       */
      const response = await fetch(
        `${API_URL}/api/analyze`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const message =
          await response.text();

        throw new Error(
          message || "Analysis failed."
        );
      }

      const data = await response.json();

      setResult(
        data.result ||
          data.analysis ||
          "Analysis completed successfully."
      );
    } catch (err) {
      console.error(
        "Analyze error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the document."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-20">
      <Link
        href="/dashboard"
        className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        ← Back to Dashboard
      </Link>

      <Reveal>
        <Header
          eyebrow="AI Tools"
          title="Analyze"
          description="Turn complex documents into structured intelligence."
        />
      </Reveal>

      <Reveal delay={100}>
        <section className="border border-slate-200 bg-white p-8">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Analysis
            </p>

            <div className="relative mt-3">
              <button
                type="button"
                onClick={() =>
                  setAnalysisOpen(
                    !analysisOpen
                  )
                }
                className="flex w-full items-center justify-between border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedAnalysis.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedAnalysis.description}
                  </p>
                </div>

                <span className="ml-4 text-slate-400">
                  {analysisOpen ? "▲" : "▼"}
                </span>
              </button>

              {analysisOpen && (
                <div className="absolute z-30 mt-2 w-full border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-200 p-3">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) =>
                        setSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search analysis..."
                      autoFocus
                      className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="max-h-[420px] overflow-y-auto p-3">
                    {(
                      [
                        "Quick",
                        "Review",
                        "Business",
                        "Advanced",
                      ] as const
                    ).map((category) => {
                      const items =
                        groupedAnalysisTypes[
                          category
                        ];

                      if (!items.length) {
                        return null;
                      }

                      return (
                        <div
                          key={category}
                          className="mb-5 last:mb-0"
                        >
                          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {category}
                          </p>

                          <div className="space-y-1">
                            {items.map(
                              (item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() =>
                                    selectAnalysis(
                                      item.id
                                    )
                                  }
                                  className={`w-full px-3 py-3 text-left transition ${
                                    item.id ===
                                    analysisId
                                      ? "bg-blue-50"
                                      : "hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p
                                        className={`text-sm font-medium ${
                                          item.id ===
                                          analysisId
                                            ? "text-blue-700"
                                            : "text-slate-900"
                                        }`}
                                      >
                                        {item.name}
                                      </p>

                                      <p className="mt-1 text-xs leading-5 text-slate-500">
                                        {
                                          item.description
                                        }
                                      </p>
                                    </div>

                                    {item.id ===
                                      analysisId && (
                                      <span className="ml-3 text-blue-600">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {!filteredAnalysisTypes.length && (
                      <p className="px-3 py-8 text-center text-sm text-slate-400">
                        No analysis types found.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-slate-400">
                Quick analyses
              </p>

              <div className="flex flex-wrap gap-2">
                {quickTypes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      selectAnalysis(
                        item.id
                      )
                    }
                    className={`border px-3 py-2 text-xs transition ${
                      item.id === analysisId
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {item.name}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setAnalysisOpen(true)
                  }
                  className="border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:border-slate-300"
                >
                  More analyses
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">
                Documents
              </p>

              <label className="cursor-pointer border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-600">
                + Upload

                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={
                    handleFileUpload
                  }
                  className="hidden"
                />
              </label>
            </div>

            <select
              value={selectedDocumentId}
              onChange={(e) =>
                handleSavedDocumentSelect(
                  e.target.value
                )
              }
              disabled={loadingDocuments}
              className="mt-3 w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {loadingDocuments
                  ? "Loading your documents..."
                  : savedDocuments.length > 0
                  ? "Select from your Documents"
                  : "No saved documents yet"}
              </option>

              {savedDocuments.length > 0 && (
                <optgroup label="My Documents">
                  {savedDocuments.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name ||
                          item.file_name ||
                          "Untitled document"}
                      </option>
                    )
                  )}
                </optgroup>
              )}
            </select>

            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50">
              <div className="flex h-11 w-11 items-center justify-center border border-slate-200 bg-white text-lg text-blue-600">
                ↑
              </div>

              <p className="mt-3 text-sm font-medium text-slate-900">
                Drop documents here or browse files
              </p>

              <p className="mt-1 text-xs text-slate-500">
                PDF, DOCX, or TXT · Multiple files supported
              </p>

              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={
                  handleFileUpload
                }
                className="hidden"
              />
            </label>
          </div>

          {uploadedDocuments.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">
                  Selected documents
                </p>

                <p className="text-xs text-slate-400">
                  {uploadedDocuments.length}{" "}
                  {uploadedDocuments.length === 1
                    ? "document"
                    : "documents"}
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {uploadedDocuments.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white text-[10px] font-bold text-blue-600">
                          {getFileExtension(
                            item.name
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {item.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {item.status ===
                            "ready"
                              ? "Ready to analyze"
                              : item.status ===
                                "uploading"
                              ? "Uploading..."
                              : "Upload error"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeDocument(
                            item.id
                          )
                        }
                        className="ml-4 text-xs font-medium text-slate-500 transition hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {selectedAnalysis.id ===
            "custom" && (
            <div className="mt-8">
              <label className="text-sm font-medium text-slate-900">
                What would you like to know?
              </label>

              <textarea
                value={customPrompt}
                onChange={(e) =>
                  setCustomPrompt(
                    e.target.value
                  )
                }
                placeholder="Example: Find every clause that could create financial risk for my company."
                rows={4}
                className="mt-3 w-full resize-none border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
          )}

          {error && (
            <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
            <div>
              <p className="text-xs text-slate-400">
                Selected analysis
              </p>

              <p className="mt-1 text-sm font-medium text-slate-700">
                {selectedAnalysis.name}
              </p>
            </div>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="border border-blue-700 bg-blue-600 px-8 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {analyzing
                ? "Analyzing..."
                : "Analyze Documents"}
            </button>
          </div>
        </section>
      </Reveal>

      <Reveal delay={150}>
        <section className="border border-slate-200 bg-white p-8">
          <div className="flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Analysis Results
              </p>

              {result && (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                    {selectedAnalysis.name}
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    AI-generated document intelligence
                  </p>
                </>
              )}
            </div>

            {result && (
              <div className="hidden border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:block">
                AI Analysis
              </div>
            )}
          </div>

          {!result && !analyzing && (
            <div className="mt-6 border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-200 bg-white text-blue-600">
                ✦
              </div>

              <p className="mt-4 text-sm font-medium text-slate-600">
                Your analysis results will appear here.
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Select an analysis type and document to get started.
              </p>
            </div>
          )}

          {analyzing && (
            <div className="mt-6">
              <div className="border border-slate-200 bg-slate-50 p-8">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 animate-pulse bg-blue-600" />

                  <p className="text-sm font-medium text-slate-700">
                    Analyzing your documents...
                  </p>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  Gemini is generating your{" "}
                  {selectedAnalysis.name.toLowerCase()}.
                </p>

                <div className="mt-6 overflow-hidden border border-slate-200 bg-white">
                  <div className="relative h-1 bg-slate-100">
                    <div className="absolute inset-y-0 left-0 w-1/3 animate-[slide_1.8s_ease-in-out_infinite] bg-blue-600" />
                  </div>

                  <div className="px-4 py-4">
                    <p className="text-xs text-slate-500">
                      Reading document structure and extracting insights...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result && (
            <Reveal className="mt-6">
              <div className="border border-slate-200 bg-slate-50 p-6">
                <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                      {selectedAnalysis.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      AI-generated analysis
                    </p>
                  </div>

                  <div className="hidden text-[10px] uppercase tracking-[0.15em] text-slate-400 sm:block">
                    DocChatAI
                  </div>
                </div>

                <div className="max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="mb-6 border-b border-slate-200 pb-4 text-2xl font-semibold tracking-tight text-slate-900">
                          {children}
                        </h1>
                      ),

                      h2: ({ children }) => (
                        <h2 className="mb-4 mt-10 border-b border-slate-200 pb-3 text-lg font-semibold text-slate-900">
                          {children}
                        </h2>
                      ),

                      h3: ({ children }) => (
                        <h3 className="mb-3 mt-7 text-base font-semibold text-slate-900">
                          {children}
                        </h3>
                      ),

                      p: ({ children }) => (
                        <p className="mb-5 text-sm leading-7 text-slate-700">
                          {children}
                        </p>
                      ),

                      strong: ({ children }) => (
                        <strong className="font-semibold text-slate-900">
                          {children}
                        </strong>
                      ),

                      ul: ({ children }) => (
                        <ul className="mb-6 ml-5 list-disc space-y-2 text-sm leading-7 text-slate-700">
                          {children}
                        </ul>
                      ),

                      ol: ({ children }) => (
                        <ol className="mb-6 ml-5 list-decimal space-y-3 text-sm leading-7 text-slate-700">
                          {children}
                        </ol>
                      ),

                      li: ({ children }) => (
                        <li className="pl-1">
                          {children}
                        </li>
                      ),

                      hr: () => (
                        <div className="my-8 border-t border-slate-200" />
                      ),

                      blockquote: ({ children }) => (
                        <blockquote className="my-6 border-l-2 border-blue-600 bg-blue-50 px-5 py-4 text-sm leading-7 text-slate-700">
                          {children}
                        </blockquote>
                      ),

                      table: ({ children }) => (
                        <div className="my-7 overflow-x-auto border border-slate-200">
                          <table className="w-full border-collapse text-sm">
                            {children}
                          </table>
                        </div>
                      ),

                      thead: ({ children }) => (
                        <thead className="bg-slate-100 text-left">
                          {children}
                        </thead>
                      ),

                      tbody: ({ children }) => (
                        <tbody>
                          {children}
                        </tbody>
                      ),

                      tr: ({ children }) => (
                        <tr className="transition hover:bg-slate-50">
                          {children}
                        </tr>
                      ),

                      th: ({ children }) => (
                        <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {children}
                        </th>
                      ),

                      td: ({ children }) => (
                        <td className="border-b border-slate-100 px-4 py-3 align-top text-sm leading-6 text-slate-700">
                          {children}
                        </td>
                      ),

                      code: ({ children }) => (
                        <code className="border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {result}
                  </ReactMarkdown>
                </div>
              </div>
            </Reveal>
          )}
        </section>
      </Reveal>
    </div>
  );
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -60px 0px",
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
      }}
      className={`transform transition-all duration-700 ease-out ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Header({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
        {eyebrow}
      </p>

      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>

      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
        {description}
      </p>
    </section>
  );
}

function UpgradeState({
  title,
  description,
  plan,
}: {
  title: string;
  description: string;
  plan: string;
}) {
  return (
    <div className="mx-auto max-w-4xl py-16">
      <div className="border border-slate-200 bg-white p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600">
          ✦
        </div>

        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
          Premium AI
        </p>

        <h1 className="mt-4 text-3xl font-semibold text-slate-900">
          {title}
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">
          {description}
        </p>

        <Link
          href="/settings/billing"
          className="mt-8 inline-block border border-blue-700 bg-blue-600 px-7 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Upgrade to {plan}
        </Link>
      </div>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="p-12 text-sm text-slate-400">
      Loading workspace...
    </div>
  );
}