"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type DocumentItem = {
  id: string;
  name: string;
  file_name?: string | null;
};

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState("");
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending]);

  const loadDocuments = async () => {
    try {
      setLoadingDocuments(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in to use Document Chat.");
        return;
      }

      const { data, error: documentsError } = await supabase
        .from("documents")
        .select("id, name, file_name")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false });

      if (documentsError) {
        throw documentsError;
      }

      const loadedDocuments = data || [];

      setDocuments(loadedDocuments);

      if (loadedDocuments.length > 0) {
        setSelectedDocument(loadedDocuments[0].id);
      }
    } catch (err) {
      console.error("Document loading error:", err);
      setError("Unable to load your documents.");
    } finally {
      setLoadingDocuments(false);
    }
  };

  const sendMessage = async (content: string) => {
    const trimmedMessage = content.trim();

    if (!trimmedMessage || sending) {
      return;
    }

    if (!selectedDocument) {
      setError("Please select a document before asking a question.");
      return;
    }

    setError("");

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmedMessage,
    };

    setMessages((previous) => [...previous, userMessage]);
    setMessage("");
    setSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const response = await fetch(
        "http://127.0.0.1:8000/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: trimmedMessage,
            document_id: selectedDocument,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to generate a response."
        );
      }

      const assistantContent =
        data?.answer ||
        data?.response ||
        data?.message ||
        "I wasn't able to generate a response.";

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: assistantContent,
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Something went wrong while generating your response.";

      setError(errorMessage);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I couldn't complete that request. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    await sendMessage(message);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setMessage("");
    setError("");
    setCopiedIndex(null);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const regenerate = async () => {
    if (sending) {
      return;
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((item) => item.role === "user");

    if (!lastUserMessage) {
      return;
    }

    const lastAssistantIndex = [...messages]
      .map((item, index) => ({
        item,
        index,
      }))
      .reverse()
      .find(({ item }) => item.role === "assistant")?.index;

    if (lastAssistantIndex !== undefined) {
      setMessages((previous) =>
        previous.filter(
          (_, index) => index !== lastAssistantIndex
        )
      );
    }

    await sendMessage(lastUserMessage.content);
  };

  const copyResponse = async (
    content: string,
    index: number
  ) => {
    try {
      await navigator.clipboard.writeText(content);

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1800);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const selectedDocumentName =
    documents.find(
      (document) => document.id === selectedDocument
    )?.name || "Select a document";

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <Link
        href="/dashboard"
        className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900"
        >
           ← Back to Dashboard
      </Link>
      <section className="relative overflow-hidden border border-slate-200 bg-white px-8 py-9 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-50 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />

            <p className="text-sm font-medium uppercase tracking-[0.22em] text-blue-600">
              AI Document Intelligence
            </p>
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Ask your documents.
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-500">
            Ask questions, uncover insights, and find important
            information with DocChatAI.
          </p>
        </div>
      </section>

      <section className="overflow-hidden border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center border border-blue-100 bg-blue-50">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Document Chat
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Ask questions based on your selected document.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                className="flex items-center gap-2 border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New chat
              </button>
            )}

            <div className="flex items-center gap-2 border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AI READY
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Current document
                </p>

                <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
                  {selectedDocumentName}
                </p>
              </div>
            </div>

            <div className="relative w-full md:w-80">
              <select
                value={selectedDocument}
                onChange={(event) => {
                  setSelectedDocument(event.target.value);
                  setError("");
                }}
                disabled={
                  loadingDocuments ||
                  documents.length === 0 ||
                  sending
                }
                className="w-full appearance-none border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                {documents.length === 0 ? (
                  <option value="">
                    {loadingDocuments
                      ? "Loading documents..."
                      : "No documents available"}
                  </option>
                ) : (
                  documents.map((document) => (
                    <option
                      key={document.id}
                      value={document.id}
                    >
                      {document.name ||
                        document.file_name ||
                        "Untitled"}
                    </option>
                  ))
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="min-h-[520px] bg-white p-5 md:p-8">
          {messages.length === 0 ? (
            <EmptyState
              documents={documents}
              loadingDocuments={loadingDocuments}
              setMessage={setMessage}
            />
          ) : (
            <div className="mx-auto max-w-4xl">
              <div className="space-y-8">
                {messages.map((chatMessage, index) => (
                  <MessageBubble
                    key={`${chatMessage.role}-${index}`}
                    message={chatMessage}
                    index={index}
                    copied={copiedIndex === index}
                    onCopy={() =>
                      copyResponse(
                        chatMessage.content,
                        index
                      )
                    }
                    onRegenerate={
                      chatMessage.role === "assistant" &&
                      index === messages.length - 1
                        ? regenerate
                        : undefined
                    }
                    sending={sending}
                  />
                ))}

                {sending && <ThinkingState />}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
            <div className="mx-auto max-w-4xl">
              {error}
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 bg-slate-50/50 p-5 md:p-7">
          <div className="mx-auto max-w-4xl">
            <div className="overflow-hidden border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition focus-within:border-blue-400 focus-within:shadow-[0_10px_35px_rgba(37,99,235,0.08)]">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedDocument
                    ? "Ask a question about your document..."
                    : "Select a document to start chatting..."
                }
                disabled={!selectedDocument || sending}
                rows={3}
                maxLength={5000}
                className="w-full resize-none border-0 bg-transparent px-5 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="hidden text-xs text-slate-400 sm:block">
                    Enter to send
                    <span className="mx-1.5">·</span>
                    Shift + Enter for a new line
                  </p>

                  {message.length > 0 && (
                    <span className="hidden text-[11px] text-slate-300 md:block">
                      {message.length}/5000
                    </span>
                  )}
                </div>

                <button
                  onClick={handleSend}
                  disabled={
                    !message.trim() ||
                    !selectedDocument ||
                    sending
                  }
                  className="flex items-center gap-2 border border-blue-700 bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 hover:shadow-[0_6px_18px_rgba(37,99,235,0.16)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Thinking
                    </>
                  ) : (
                    <>
                      Send
                      <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Responses are generated from your selected document.
              </p>

              <p className="hidden text-xs text-slate-400 sm:block">
                DocChatAI
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
              What you can ask
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Turn documents into answers.
            </h2>
          </div>

          <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">
            <Plus className="h-3.5 w-3.5" />
            More intelligence built in
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Capability
            title="Summarize"
            description="Get concise summaries of long and complex documents."
          />

          <Capability
            title="Analyze"
            description="Understand important information, context, and meaning."
          />

          <Capability
            title="Extract"
            description="Find dates, names, numbers, requirements, and key details."
          />

          <Capability
            title="Compare"
            description="Identify meaningful differences and similarities across documents."
          />
        </div>
      </section>
    </div>
  );
}

function EmptyState({
  documents,
  loadingDocuments,
  setMessage,
}: {
  documents: DocumentItem[];
  loadingDocuments: boolean;
  setMessage: (value: string) => void;
}) {
  return (
    <div className="flex min-h-[450px] items-center justify-center">
      <div className="w-full max-w-2xl text-center">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center border border-blue-100 bg-blue-50">
          <Sparkles className="h-7 w-7 text-blue-600" />

          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
        </div>

        <p className="mt-7 text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
          Start a conversation
        </p>

        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
          What would you like to know?
        </h3>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">
          Ask DocChatAI to summarize, explain, extract information,
          or uncover important details from your document.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
          <Suggestion
            text="Summarize this document"
            onClick={() =>
              setMessage("Summarize this document")
            }
          />

          <Suggestion
            text="What are the key points?"
            onClick={() =>
              setMessage("What are the key points?")
            }
          />

          <Suggestion
            text="Find important dates"
            onClick={() =>
              setMessage(
                "Find the important dates in this document"
              )
            }
          />

          <Suggestion
            text="Explain this document simply"
            onClick={() =>
              setMessage(
                "Explain this document in simple terms"
              )
            }
          />
        </div>

        {documents.length === 0 && !loadingDocuments && (
          <div className="mt-6 border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Upload a document first to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  index,
  copied,
  onCopy,
  onRegenerate,
  sending,
}: {
  message: ChatMessage;
  index: number;
  copied: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
  sending: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={
        isUser
          ? "flex justify-end"
          : "flex justify-start"
      }
    >
      <div
        className={
          isUser
            ? "max-w-2xl"
            : "w-full max-w-3xl"
        }
      >
        <div
          className={
            isUser
              ? "mb-2 flex justify-end"
              : "mb-2 flex items-center gap-2"
          }
        >
          {!isUser && (
            <div className="flex h-6 w-6 items-center justify-center border border-blue-100 bg-blue-50">
              <Sparkles className="h-3 w-3 text-blue-600" />
            </div>
          )}

          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {isUser ? "You" : "DocChatAI"}
          </p>
        </div>

        <div
          className={
            isUser
              ? "border border-blue-700 bg-blue-600 px-5 py-4 text-sm leading-7 text-white shadow-[0_8px_24px_rgba(37,99,235,0.14)]"
              : "border border-slate-200 bg-white px-6 py-5 text-slate-700 shadow-[0_8px_28px_rgba(15,23,42,0.035)]"
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <FormattedResponse content={message.content} />
          )}
        </div>

        {!isUser && (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              title="Copy response"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>

            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={sending}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                title="Regenerate response"
              >
                <RotateCcw className="h-3 w-3" />
                Regenerate
              </button>
            )}

            <span className="ml-1 text-[10px] text-slate-300">
              ·
            </span>

            <span className="ml-1 text-[10px] text-slate-300">
              AI-generated
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function FormattedResponse({
  content,
}: {
  content: string;
}) {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .trim();

  const lines = normalized.split("\n");

  const elements: React.ReactNode[] = [];

  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      index++;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line
        .replace("```", "")
        .trim();

      const codeLines: string[] = [];

      index++;

      while (
        index < lines.length &&
        !lines[index].trim().startsWith("```")
      ) {
        codeLines.push(lines[index]);
        index++;
      }

      if (index < lines.length) {
        index++;
      }

      elements.push(
        <div
          key={`code-${index}`}
          className="my-4 overflow-hidden border border-slate-800 bg-slate-950"
        >
          {language && (
            <div className="border-b border-slate-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {language}
            </div>
          )}

          <pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-200">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );

      continue;
    }

    const headingMatch = line.match(
      /^(#{1,3})\s+(.+)$/
    );

    if (headingMatch) {
      const headingLevel = headingMatch[1].length;
      const headingText = headingMatch[2];

      if (headingLevel === 1) {
        elements.push(
          <h3
            key={`h1-${index}`}
            className="mb-3 mt-6 text-xl font-semibold tracking-tight text-slate-950 first:mt-0"
          >
            {formatInline(headingText)}
          </h3>
        );
      } else if (headingLevel === 2) {
        elements.push(
          <h4
            key={`h2-${index}`}
            className="mb-2 mt-5 text-base font-semibold text-slate-950"
          >
            {formatInline(headingText)}
          </h4>
        );
      } else {
        elements.push(
          <h5
            key={`h3-${index}`}
            className="mb-2 mt-4 text-sm font-semibold text-slate-900"
          >
            {formatInline(headingText)}
          </h5>
        );
      }

      index++;
      continue;
    }

    if (isBulletLine(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();

        if (!isBulletLine(current)) {
          break;
        }

        items.push(cleanListItem(current));
        index++;
      }

      elements.push(
        <ul
          key={`ul-${index}`}
          className="my-4 space-y-2.5 pl-5"
        >
          {items.map((item, itemIndex) => (
            <li
              key={itemIndex}
              className="relative pl-1 leading-7"
            >
              <span className="absolute -left-4 top-[0.72rem] h-1.5 w-1.5 rounded-full bg-blue-500" />
              {formatInline(item)}
            </li>
          ))}
        </ul>
      );

      continue;
    }

    if (isNumberedLine(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();

        if (!isNumberedLine(current)) {
          break;
        }

        items.push(cleanNumberedItem(current));
        index++;
      }

      elements.push(
        <ol
          key={`ol-${index}`}
          className="my-4 space-y-2.5 pl-7"
        >
          {items.map((item, itemIndex) => (
            <li
              key={itemIndex}
              className="pl-1 leading-7 marker:font-semibold marker:text-blue-600"
            >
              {formatInline(item)}
            </li>
          ))}
        </ol>
      );

      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();

        if (!current.startsWith(">")) {
          break;
        }

        quoteLines.push(
          current.replace(/^>\s?/, "")
        );

        index++;
      }

      elements.push(
        <blockquote
          key={`quote-${index}`}
          className="my-4 border-l-2 border-blue-300 bg-blue-50/50 px-4 py-3 text-sm italic leading-7 text-slate-600"
        >
          {quoteLines.map((quote, quoteIndex) => (
            <p
              key={quoteIndex}
              className={
                quoteIndex > 0
                  ? "mt-2"
                  : ""
              }
            >
              {formatInline(quote)}
            </p>
          ))}
        </blockquote>
      );

      continue;
    }

    if (
      /^-{3,}$/.test(line) ||
      /^\*{3,}$/.test(line)
    ) {
      elements.push(
        <hr
          key={`hr-${index}`}
          className="my-6 border-slate-200"
        />
      );

      index++;
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const current = lines[index].trim();

      if (
        !current ||
        current.startsWith("#") ||
        isBulletLine(current) ||
        isNumberedLine(current) ||
        current.startsWith(">") ||
        current.startsWith("```") ||
        /^-{3,}$/.test(current) ||
        /^\*{3,}$/.test(current)
      ) {
        break;
      }

      paragraphLines.push(current);
      index++;
    }

    if (paragraphLines.length > 0) {
      elements.push(
        <p
          key={`p-${index}`}
          className="my-3 leading-7 text-slate-700"
        >
          {formatInline(
            paragraphLines.join(" ")
          )}
        </p>
      );
    } else {
      index++;
    }
  }

  return (
    <div className="text-[14px] leading-7">
      {elements}
    </div>
  );
}

function formatInline(
  text: string
): React.ReactNode[] {
  const parts = text.split(
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/
  );

  return parts.map((part, index) => {
    if (
      part.startsWith("**") &&
      part.endsWith("**")
    ) {
      return (
        <strong
          key={index}
          className="font-semibold text-slate-950"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      !part.startsWith("**")
    ) {
      return (
        <em
          key={index}
          className="italic"
        >
          {part.slice(1, -1)}
        </em>
      );
    }

    if (
      part.startsWith("`") &&
      part.endsWith("`")
    ) {
      return (
        <code
          key={index}
          className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(
      /^\[([^\]]+)\]\(([^)]+)\)$/
    );

    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-600 underline decoration-blue-200 underline-offset-2 transition hover:text-blue-700"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return (
      <span key={index}>
        {part}
      </span>
    );
  });
}

function isBulletLine(line: string) {
  return /^[-*•]\s+/.test(line);
}

function cleanListItem(line: string) {
  return line.replace(/^[-*•]\s+/, "");
}

function isNumberedLine(line: string) {
  return /^\d+[.)]\s+/.test(line);
}

function cleanNumberedItem(line: string) {
  return line.replace(/^\d+[.)]\s+/, "");
}

function ThinkingState() {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-3xl">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center border border-blue-100 bg-blue-50">
            <Sparkles className="h-3 w-3 animate-pulse text-blue-600" />
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            DocChatAI
          </p>
        </div>

        <div className="border border-slate-200 bg-white px-6 py-5 shadow-[0_8px_28px_rgba(15,23,42,0.035)]">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
            </div>

            <span className="text-sm text-slate-400">
              Reading your document...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Suggestion({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_8px_24px_rgba(37,99,235,0.07)]"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-slate-700 transition group-hover:text-blue-600">
          {text}
        </span>

        <Send className="h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
      </div>
    </button>
  );
}

function Capability({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="group border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-blue-600">
          {title}
        </p>

        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 opacity-60 transition group-hover:scale-125" />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}