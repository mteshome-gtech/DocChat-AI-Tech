"use client";

import Link from "next/link";
import { useState } from "react";

const services = [
  {
    id: "chat",
    number: "01",
    name: "DocChat",
    label: "ASK YOUR DOCUMENTS",
    description:
      "Ask questions, find answers, and have intelligent conversations with your documents.",
    prompt: "What are the key findings?",
    answer:
      "The document identifies three primary findings supported by the research...",
    icon: "chat",
  },
  {
    id: "analyze",
    number: "02",
    name: "DocAnalyze",
    label: "DEEP ANALYSIS",
    description:
      "Turn complex documents into structured insights, summaries, findings, risks, and conclusions.",
    prompt: "Analyze this document",
    answer:
      "The document contains several important findings, supporting evidence, and potential risks...",
    icon: "analyze",
  },
  {
    id: "translate",
    number: "03",
    name: "DocTranslate",
    label: "TRANSLATE",
    description:
      "Translate documents while preserving structure, formatting, hierarchy, and visual context.",
    prompt: "Translate this document",
    answer:
      "Translation complete — the original document structure and visual hierarchy have been preserved.",
    icon: "translate",
  },
  {
    id: "compare",
    number: "04",
    name: "DocCompare",
    label: "COMPARE DOCUMENTS",
    description:
      "Compare multiple documents and instantly identify differences, similarities, and important changes.",
    prompt: "Compare these documents",
    answer:
      "The documents share several common themes, but three significant differences were identified...",
    icon: "compare",
  },
  {
    id: "research",
    number: "05",
    name: "DocResearch",
    label: "ADVANCED RESEARCH",
    description:
      "Go deeper with research workflows designed to uncover evidence, context, and meaningful insights.",
    prompt: "Research this topic",
    answer:
      "The research reveals several supporting sources and emerging themes related to this topic...",
    icon: "research",
  },
  {
    id: "create",
    number: "06",
    name: "DocCreate",
    label: "COMING SOON",
    description:
      "Turn your information into polished reports, summaries, briefs, presentations, and new documents.",
    prompt: "Create an executive brief",
    answer: "Coming soon",
    icon: "create",
  },
];

const solutions = [
  {
    number: "01",
    title: "For students",
    description:
      "Study faster by asking questions, analyzing readings, comparing sources, and translating academic material.",
    tags: ["Study", "Research", "Analyze", "Translate"],
  },
  {
    number: "02",
    title: "For researchers",
    description:
      "Move from hundreds of pages to structured findings, evidence, comparisons, and research insights.",
    tags: ["Research", "Analyze", "Compare", "Evidence"],
  },
  {
    number: "03",
    title: "For professionals",
    description:
      "Understand reports, contracts, presentations, policies, and business documents without digging through every page manually.",
    tags: ["Analyze", "Compare", "Research", "Chat"],
  },
];

const founders = [
  {
    name: "Michael",
    role: "Co-Founder · Software Engineer",
    description:
      "Building the product, platform, and engineering systems behind DocChatAI.",
  },
  {
    name: "Azil",
    role: "Co-Founder · ML Engineer",
    description:
      "Building the intelligence and machine-learning systems that power document understanding.",
  },
];

function DocumentIcon({
  type,
  className = "w-8 h-8",
}: {
  type: string;
  className?: string;
}) {
  if (type === "chat") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M5 4h14v12H9l-4 4V4Z" />
        <path d="M8 8h8M8 11h5" />
      </svg>
    );
  }

  if (type === "analyze") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M8 15v-3M12 15V8M16 15v-5" />
      </svg>
    );
  }

  if (type === "translate") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 5h10M9 5c0 5-2 8-6 11M6 11c2 2 4 3 7 4" />
        <path d="M14 13h6M17 10l-3 9M14.5 16h5" />
      </svg>
    );
  }

  if (type === "compare") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="5" width="7" height="14" />
        <rect x="14" y="5" width="7" height="14" />
        <path d="M10 12h4M12 10l2 2-2 2" />
      </svg>
    );
  }

  if (type === "research") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 5 5" />
        <path d="M8 10.5h5M10.5 8v5" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M5 3h10l4 4v14H5V3Z" />
      <path d="M15 3v5h4M8 12h8M8 16h6" />
    </svg>
  );
}

function FadeUp({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`animate-[fadeUp_0.8s_ease-out_forwards] opacity-0 ${className}`}
    >
      {children}
    </div>
  );
}

function ServiceStage({
  service,
  index,
}: {
  service: (typeof services)[number];
  index: number;
}) {
  const isComingSoon = service.id === "create";

  return (
    <section
      id={`service-${service.id}`}
      className="relative min-h-[620px] border-t border-black/10 py-24"
    >
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <div className="mb-8 flex items-center gap-4">
            <span
              className={`text-xs font-semibold tracking-[0.25em] ${
                isComingSoon ? "text-amber-500" : "text-blue-600"
              }`}
            >
              {service.number} / {service.label}
            </span>
          </div>

          <h3 className="text-5xl font-medium tracking-[-0.04em] text-black md:text-6xl">
            {service.name}
          </h3>

          <p className="mt-7 max-w-xl text-lg leading-8 text-black/55">
            {service.description}
          </p>

          {!isComingSoon && (
            <Link
              href={
                service.id === "chat"
                  ? "/chat"
                  : service.id === "analyze"
                    ? "/analyze"
                    : service.id === "translate"
                      ? "/translate"
                      : service.id === "compare"
                        ? "/compare"
                        : "/research"
              }
              className="mt-9 inline-flex items-center border border-black px-6 py-3 text-sm font-medium transition hover:bg-black hover:text-white"
            >
              Open {service.name}
              <span className="ml-3">→</span>
            </Link>
          )}
        </div>

        <div className="relative">
          <div className="border border-black/10 bg-white">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <DocumentIcon type={service.icon} className="h-6 w-6" />
                <span className="text-sm font-medium">Document Workspace</span>
              </div>

              <span
                className={`text-[10px] uppercase tracking-[0.2em] ${
                  isComingSoon ? "text-amber-500" : "text-black/35"
                }`}
              >
                {isComingSoon ? "Coming Soon" : "AI Workspace"}
              </span>
            </div>

            <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-2">
              <div className="border-b border-black/10 p-7 md:border-b-0 md:border-r">
                <div className="mb-5 text-[10px] uppercase tracking-[0.2em] text-black/35">
                  Prompt
                </div>

                <div className="border border-black/10 bg-[#fafafa] p-5">
                  <p className="text-sm leading-7 text-black/70">
                    {service.prompt}
                  </p>
                </div>

                <div className="mt-8">
                  <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-black/35">
                    Document
                  </div>

                  <div className="border border-black/10 p-5">
                    <div className="flex items-center gap-4">
                      <DocumentIcon
                        type="create"
                        className="h-8 w-8 text-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium">
                          Research Document.pdf
                        </p>
                        <p className="mt-1 text-xs text-black/35">
                          42 pages · 8.2 MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-7">
                <div className="mb-5 text-[10px] uppercase tracking-[0.2em] text-black/35">
                  {isComingSoon ? "Status" : "AI Response"}
                </div>

                <div
                  className={`min-h-[250px] border p-6 ${
                    isComingSoon
                      ? "border-amber-500/30 bg-amber-50"
                      : "border-black/10 bg-[#fafafa]"
                  }`}
                >
                  <div className="mb-6 flex items-center gap-3">
                    <div
                      className={`h-2 w-2 ${
                        isComingSoon ? "bg-amber-500" : "bg-blue-600"
                      }`}
                    />

                    <span className="text-xs font-medium uppercase tracking-[0.15em]">
                      {isComingSoon ? "Coming Soon" : "DocChatAI"}
                    </span>
                  </div>

                  <p className="text-sm leading-7 text-black/65">
                    {service.answer}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-5 -right-5 hidden border border-black/10 bg-white px-5 py-3 text-xs tracking-wide text-black/45 md:block">
            {String(index + 1).padStart(2, "0")} / 06
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [founderOpen, setFounderOpen] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[#f8f8f6] text-black">

      {/* NAVIGATION */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-black/10 bg-[#f8f8f6]/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 md:px-10">
          <Link href="/" className="text-xl font-semibold tracking-[-0.04em]">
            DocChatAI
          </Link>

          <div className="hidden items-center gap-8 text-sm text-black/55 md:flex">
            <a href="#platform" className="transition hover:text-black">
              Platform
            </a>
            <a href="#solutions" className="transition hover:text-black">
              Solutions
            </a>
            <a href="#pricing" className="transition hover:text-black">
              Pricing
            </a>
            <a href="#founders" className="transition hover:text-black">
              Founders
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="hidden px-4 py-2 text-sm text-black/60 transition hover:text-black sm:block"
            >
              Log in
            </Link>

            <Link
              href="/auth/signup?plan=free"
              className="border border-black bg-black px-5 py-2.5 text-sm text-white transition hover:bg-black/80"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-black/10 pt-20">
        <div className="mx-auto grid min-h-[760px] max-w-[1400px] grid-cols-1 items-center gap-16 px-6 py-24 md:px-10 lg:grid-cols-[1.05fr_0.95fr]">
          <FadeUp>
            <div className="max-w-3xl">
              <div className="mb-8 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-blue-600">
                <span className="h-2 w-2 bg-blue-600" />
                Intelligent document workspace
              </div>

              <h1 className="text-6xl font-medium leading-[0.95] tracking-[-0.06em] md:text-8xl">
                Your documents.
                <br />
                <span className="text-black/35">Understood.</span>
              </h1>

              <p className="mt-10 max-w-2xl text-lg leading-8 text-black/55 md:text-xl">
                Upload a document. Ask questions. Discover insights.
                Translate, compare, and research — all from one intelligent
                workspace.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/auth/signup?plan=free"
                  className="border border-black bg-black px-7 py-4 text-sm font-medium text-white transition hover:bg-black/80"
                >
                  Start for free
                  <span className="ml-5">→</span>
                </Link>

                <a
                  href="#platform"
                  className="border border-black/15 px-7 py-4 text-sm font-medium transition hover:border-black hover:bg-white"
                >
                  Explore platform
                </a>
              </div>
            </div>
          </FadeUp>

          <FadeUp className="delay-150">
            <div className="relative mx-auto w-full max-w-[570px]">
              <div className="relative border border-black/15 bg-white p-5">
                <div className="border border-black/10">
                  <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <DocumentIcon
                        type="chat"
                        className="h-6 w-6 text-blue-600"
                      />
                      <span className="text-sm font-medium">
                        Research Document.pdf
                      </span>
                    </div>

                    <span className="text-[10px] uppercase tracking-[0.2em] text-black/30">
                      42 pages
                    </span>
                  </div>

                  <div className="grid grid-cols-[90px_1fr]">
                    <div className="border-r border-black/10 bg-[#fafafa] p-3">
                      {[1, 2, 3, 4, 5].map((page) => (
                        <div
                          key={page}
                          className={`mb-3 flex aspect-[0.72] items-center justify-center border text-[10px] ${
                            page === 1
                              ? "border-blue-600 bg-blue-50 text-blue-600"
                              : "border-black/10 bg-white text-black/25"
                          }`}
                        >
                          {page}
                        </div>
                      ))}
                    </div>

                    <div className="p-8">
                      <div className="mb-8 h-2 w-3/5 bg-black/10" />
                      <div className="space-y-3">
                        <div className="h-2 w-full bg-black/5" />
                        <div className="h-2 w-11/12 bg-black/5" />
                        <div className="h-2 w-4/5 bg-black/5" />
                        <div className="h-2 w-full bg-black/5" />
                      </div>

                      <div className="mt-10 border border-blue-600/20 bg-blue-50/50 p-5">
                        <div className="mb-3 text-[9px] uppercase tracking-[0.2em] text-blue-600">
                          Ask DocChatAI
                        </div>

                        <p className="text-sm leading-6 text-black/60">
                          What are the primary findings in this research?
                        </p>
                      </div>

                      <div className="mt-6 border-l-2 border-blue-600 pl-5">
                        <p className="text-sm leading-7 text-black/60">
                          The research identifies three primary findings
                          supported by the evidence presented across the
                          document...
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-7 -left-7 border border-black/10 bg-white px-5 py-4">
                <div className="text-[9px] uppercase tracking-[0.2em] text-black/35">
                  AI document intelligence
                </div>
                <div className="mt-1 text-sm font-medium">
                  Understand more. Search less.
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-black/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-6 px-6 py-7 md:px-10">
          <span className="text-xs uppercase tracking-[0.22em] text-black/35">
            Built for document-heavy work
          </span>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs uppercase tracking-[0.18em] text-black/40">
            <span>PDF</span>
            <span>Research</span>
            <span>Analysis</span>
            <span>Translation</span>
            <span>Comparison</span>
            <span>AI</span>
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="border-b border-black/10">
        <div className="mx-auto max-w-[1400px] px-6 py-28 md:px-10">
          <FadeUp>
            <div className="max-w-4xl">
              <div className="mb-7 text-xs uppercase tracking-[0.25em] text-blue-600">
                One workspace
              </div>

              <h2 className="text-5xl font-medium leading-[1] tracking-[-0.05em] md:text-7xl">
                Everything you need to
                <br />
                <span className="text-black/35">understand a document.</span>
              </h2>

              <p className="mt-9 max-w-2xl text-lg leading-8 text-black/50">
                DocChatAI brings document conversations, deep analysis,
                translation, comparison, and research into one focused
                workspace.
              </p>
            </div>
          </FadeUp>

          <div className="mt-24">
            {services.map((service, index) => (
              <ServiceStage
                key={service.id}
                service={service}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* STATEMENT */}
      <section className="border-b border-black/10 bg-black text-white">
        <div className="mx-auto max-w-[1400px] px-6 py-32 md:px-10 md:py-44">
          <FadeUp>
            <div className="max-w-6xl">
              <div className="mb-8 text-xs uppercase tracking-[0.25em] text-blue-400">
                The idea
              </div>

              <h2 className="text-5xl font-medium leading-[0.98] tracking-[-0.055em] md:text-8xl">
                Stop reading
                <br />
                <span className="text-white/35">everything.</span>
                <br />
                Start understanding
                <br />
                <span className="text-blue-400">what matters.</span>
              </h2>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* SOLUTIONS */}
      <section id="solutions" className="border-b border-black/10">
        <div className="mx-auto max-w-[1400px] px-6 py-28 md:px-10">
          <FadeUp>
            <div className="mb-20 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div>
                <div className="mb-5 text-xs uppercase tracking-[0.25em] text-blue-600">
                  Built for real work
                </div>

                <h2 className="text-5xl font-medium tracking-[-0.05em] md:text-7xl">
                  One platform.
                  <br />
                  <span className="text-black/35">Many workflows.</span>
                </h2>
              </div>

              <p className="max-w-md text-base leading-7 text-black/50">
                Whether you're studying, researching, translating, or working
                through complex business documents, DocChatAI helps you move
                faster.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 border-l border-t border-black/10 md:grid-cols-3">
            {solutions.map((solution) => (
              <div
                key={solution.number}
                className="border-b border-r border-black/10 p-8 md:min-h-[420px] md:p-10"
              >
                <div className="text-xs tracking-[0.2em] text-blue-600">
                  {solution.number}
                </div>

                <h3 className="mt-20 text-3xl font-medium tracking-[-0.04em]">
                  {solution.title}
                </h3>

                <p className="mt-5 text-sm leading-7 text-black/50">
                  {solution.description}
                </p>

                <div className="mt-10 flex flex-wrap gap-2">
                  {solution.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-black/10 px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-black/45"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOUNDERS */}
      <section id="founders" className="border-b border-black/10">
        <div className="mx-auto max-w-[1400px] px-6 py-28 md:px-10">
          <FadeUp>
            <div className="mb-20">
              <div className="mb-5 text-xs uppercase tracking-[0.25em] text-blue-600">
                The people behind it
              </div>

              <h2 className="text-5xl font-medium tracking-[-0.05em] md:text-7xl">
                Built with purpose.
              </h2>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 border-l border-t border-black/10 md:grid-cols-2">
            {founders.map((founder) => (
              <button
                key={founder.name}
                onClick={() => setFounderOpen(founder.name)}
                className="group border-b border-r border-black/10 p-8 text-left transition hover:bg-white md:p-12"
              >
                <div className="flex aspect-[1.2] items-end border border-black/10 bg-[#f1f1ee] p-7">
                  <div>
                    <div className="text-4xl font-medium tracking-[-0.04em]">
                      {founder.name}
                    </div>

                    <div className="mt-2 text-xs uppercase tracking-[0.15em] text-blue-600">
                      {founder.role}
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-between">
                  <p className="max-w-md text-sm leading-7 text-black/50">
                    {founder.description}
                  </p>

                  <span className="ml-5 text-xl transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-b border-black/10">
        <div className="mx-auto max-w-[1400px] px-6 py-28 md:px-10">
          <FadeUp>
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-5 text-xs uppercase tracking-[0.25em] text-blue-600">
                Simple pricing
              </div>

              <h2 className="text-5xl font-medium tracking-[-0.05em] md:text-7xl">
                Start free.
                <br />
                <span className="text-black/35">Go further with Pro.</span>
              </h2>

              <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-black/50">
                Start exploring document intelligence for free. Upgrade when
                you need deeper analysis, research, comparison, translation,
                and unlimited documents.
              </p>
            </div>
          </FadeUp>

          <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 border-l border-t border-black/10 md:grid-cols-2">
            {/* FREE */}
            <div className="border-b border-r border-black/10 bg-white p-8 md:p-10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-black/35">
                    Free
                  </div>

                  <h3 className="mt-5 text-3xl font-medium tracking-[-0.04em]">
                    $0
                  </h3>
                </div>
              </div>

              <p className="mt-5 min-h-[56px] text-sm leading-7 text-black/50">
                Explore document intelligence at no cost.
              </p>

              <Link
                href="/auth/signup?plan=free"
                className="mt-8 block border border-black px-6 py-4 text-center text-sm font-medium transition hover:bg-black hover:text-white"
              >
                Get started free
              </Link>

              <div className="mt-10 border-t border-black/10 pt-8">
                <div className="mb-5 text-[10px] uppercase tracking-[0.2em] text-black/35">
                  Includes
                </div>

                <ul className="space-y-4 text-sm text-black/65">
                  <li className="flex gap-3">
                    <span className="text-blue-600">+</span>
                    Up to 5 documents
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-600">+</span>
                    Basic DocChat
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-600">+</span>
                    Basic analysis
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-600">+</span>
                    Standard AI
                  </li>
                </ul>
              </div>
            </div>

            {/* PRO */}
            <div className="relative border-b border-r border-black/10 bg-black p-8 text-white md:p-10">
              <div className="absolute right-6 top-6 border border-blue-400/30 px-3 py-2 text-[9px] uppercase tracking-[0.2em] text-blue-400">
                Most popular
              </div>

              <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                Pro
              </div>

              <h3 className="mt-5 text-3xl font-medium tracking-[-0.04em]">
                $19.99
                <span className="ml-2 text-sm font-normal text-white/40">
                  / month
                </span>
              </h3>

              <p className="mt-5 min-h-[56px] text-sm leading-7 text-white/50">
                For serious individual users who need more from their
                documents.
              </p>

              <Link
                href="/auth/signup?plan=pro"
                className="mt-8 block border border-white bg-white px-6 py-4 text-center text-sm font-medium text-black transition hover:bg-white/90"
              >
                Upgrade to Pro
              </Link>

              <div className="mt-10 border-t border-white/10 pt-8">
                <div className="mb-5 text-[10px] uppercase tracking-[0.2em] text-white/35">
                  Includes
                </div>

                <ul className="space-y-4 text-sm text-white/70">
                  <li className="flex gap-3">
                    <span className="text-blue-400">+</span>
                    Unlimited documents
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-400">+</span>
                    Advanced DocChat
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-400">+</span>
                    Deep document analysis
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-400">+</span>
                    Translation
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-400">+</span>
                    Document comparison
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-400">+</span>
                    Advanced research
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-400">+</span>
                    Priority AI
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-b border-black/10 bg-[#eef3ff]">
        <div className="mx-auto max-w-[1400px] px-6 py-32 text-center md:px-10 md:py-40">
          <FadeUp>
            <div className="mx-auto max-w-4xl">
              <div className="mb-6 text-xs uppercase tracking-[0.25em] text-blue-600">
                Ready when you are
              </div>

              <h2 className="text-5xl font-medium leading-[0.98] tracking-[-0.055em] md:text-8xl">
                Your documents
                <br />
                are waiting.
              </h2>

              <p className="mx-auto mt-8 max-w-xl text-base leading-7 text-black/50">
                Start with five documents for free. Upgrade to Pro whenever
                you need the full DocChatAI workspace.
              </p>

              <div className="mt-10 flex justify-center gap-4">
                <Link
                  href="/auth/signup?plan=free"
                  className="border border-black bg-black px-8 py-4 text-sm font-medium text-white transition hover:bg-black/80"
                >
                  Get started free
                  <span className="ml-5">→</span>
                </Link>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="mx-auto max-w-[1400px] px-6 py-14 md:px-10">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
            <div>
              <Link
                href="/"
                className="text-xl font-semibold tracking-[-0.04em]"
              >
                DocChatAI
              </Link>

              <p className="mt-5 max-w-xs text-sm leading-7 text-black/45">
                Intelligent tools for understanding, analyzing, translating,
                comparing, and researching documents.
              </p>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-black/35">
                Platform
              </div>

              <div className="mt-5 space-y-3 text-sm text-black/55">
                <Link href="/chat" className="block hover:text-black">
                  DocChat
                </Link>
                <Link href="/analyze" className="block hover:text-black">
                  DocAnalyze
                </Link>
                <Link href="/translate" className="block hover:text-black">
                  DocTranslate
                </Link>
                <Link href="/compare" className="block hover:text-black">
                  DocCompare
                </Link>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-black/35">
                More
              </div>

              <div className="mt-5 space-y-3 text-sm text-black/55">
                <Link href="/research" className="block hover:text-black">
                  DocResearch
                </Link>
                <a href="#pricing" className="block hover:text-black">
                  Pricing
                </a>
                <a href="#founders" className="block hover:text-black">
                  Founders
                </a>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-black/35">
                Account
              </div>

              <div className="mt-5 space-y-3 text-sm text-black/55">
                <Link href="/auth/login" className="block hover:text-black">
                  Log in
                </Link>
                <Link
                  href="/auth/signup?plan=free"
                  className="block hover:text-black"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col justify-between gap-5 border-t border-black/10 pt-7 text-xs text-black/35 md:flex-row">
            <span>© 2026 DocChatAI. All rights reserved.</span>
            <span>Built for understanding.</span>
          </div>
        </div>
      </footer>

      {/* FOUNDER MODAL */}
      {founderOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setFounderOpen(null)}
        >
          <div
            className="w-full max-w-xl border border-black/10 bg-[#f8f8f6] p-8 md:p-10"
            onClick={(event) => event.stopPropagation()}
          >
            {founders
              .filter((founder) => founder.name === founderOpen)
              .map((founder) => (
                <div key={founder.name}>
                  <div className="flex items-start justify-between gap-8">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-blue-600">
                        Founder
                      </div>

                      <h3 className="mt-4 text-4xl font-medium tracking-[-0.04em]">
                        {founder.name}
                      </h3>

                      <p className="mt-2 text-sm text-black/45">
                        {founder.role}
                      </p>
                    </div>

                    <button
                      onClick={() => setFounderOpen(null)}
                      className="text-2xl text-black/40 transition hover:text-black"
                    >
                      ×
                    </button>
                  </div>

                  <p className="mt-10 text-base leading-8 text-black/55">
                    {founder.description}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </main>
  );
}