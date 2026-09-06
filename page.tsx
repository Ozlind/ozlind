import {
  ArrowRight,
  Bot,
  Code2,
  Github,
  ImageIcon,
  MessageSquare,
  Sparkles,
  Wand2,
} from "lucide-react";

const features = [
  {
    title: "AI Chat",
    description: "Talk, brainstorm and get intelligent answers with your AI companion.",
    icon: MessageSquare,
  },
  {
    title: "AI Image",
    description: "Create and explore visual ideas from natural-language prompts.",
    icon: ImageIcon,
  },
  {
    title: "Photo Editor",
    description: "Edit, enhance and transform your images in one workspace.",
    icon: Wand2,
  },
  {
    title: "Code Assistant",
    description: "Write, explain, refactor and debug code with AI assistance.",
    icon: Code2,
  },
  {
    title: "GitHub Agent",
    description: "Connect your development workflow with an AI-powered repository assistant.",
    icon: Github,
  },
  {
    title: "AI Workspace",
    description: "Bring your AI tools together in one focused, premium experience.",
    icon: Bot,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050507]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(91,33,182,0.22),transparent_38%),radial-gradient(circle_at_100%_60%,rgba(37,99,235,0.12),transparent_30%)]" />

      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-glow">
            <Sparkles className="h-5 w-5 text-violet-300" />
          </div>
          <span className="text-xl font-bold tracking-tight">OZLIND</span>
        </div>

        <div className="hidden items-center gap-8 text-sm text-white/55 md:flex">
          <a href="#features" className="transition hover:text-white">Features</a>
          <a href="#about" className="transition hover:text-white">About</a>
        </div>

        <a
          href="#features"
          className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Explore
        </a>
      </nav>

      <section className="relative mx-auto flex max-w-7xl flex-col items-center px-5 pb-20 pt-20 text-center sm:px-8 sm:pt-28">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-200">
          <Sparkles className="h-3.5 w-3.5" />
          The intelligent workspace for everything
        </div>

        <h1 className="max-w-4xl text-5xl font-black tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
          Your All-in-One
          <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
            AI Companion
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
          Chat, create, code and work smarter from one beautiful AI workspace.
          OZLIND brings your everyday AI tools together.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a
            href="#features"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:scale-[1.02]"
          >
            Explore OZLIND
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </a>
          <a
            href="#about"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Learn more
          </a>
        </div>

        <div className="mt-16 w-full max-w-5xl rounded-3xl border border-white/10 bg-white/[0.035] p-2 shadow-glow">
          <div className="rounded-[22px] border border-white/[0.06] bg-[#09090d] p-4 sm:p-6">
            <div className="mb-5 flex items-center gap-2 border-b border-white/[0.07] pb-4">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="ml-3 text-xs text-white/30">OZLIND Workspace</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.07] p-5 text-left">
                <MessageSquare className="mb-8 h-5 w-5 text-violet-300" />
                <p className="font-semibold">AI Chat</p>
                <p className="mt-1 text-xs text-white/40">Your intelligent conversation space</p>
              </div>
              <div className="rounded-2xl border border-blue-400/15 bg-blue-500/[0.07] p-5 text-left">
                <Code2 className="mb-8 h-5 w-5 text-blue-300" />
                <p className="font-semibold">Code Assistant</p>
                <p className="mt-1 text-xs text-white/40">Build and understand code faster</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/[0.07] p-5 text-left">
                <Wand2 className="mb-8 h-5 w-5 text-fuchsia-300" />
                <p className="font-semibold">Creative Studio</p>
                <p className="mt-1 text-xs text-white/40">Turn ideas into visuals</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-semibold text-violet-300">ONE ECOSYSTEM</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need, in one place.
          </h2>
          <p className="mt-4 text-white/50">
            A modular foundation designed to grow with the OZLIND vision.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="group rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.045]"
              >
                <div className="mb-12 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                  <Icon className="h-5 w-5 text-violet-300" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/45">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="about" className="relative mx-auto max-w-7xl px-5 py-16 text-center sm:px-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 sm:p-12">
          <Bot className="mx-auto h-8 w-8 text-violet-300" />
          <h2 className="mt-5 text-2xl font-bold">Built for the future of AI</h2>
          <p className="mt-3 text-sm leading-6 text-white/45">
            OZLIND starts with a secure, modular foundation and is designed to
            expand into a complete AI ecosystem.
          </p>
        </div>
      </section>

      <footer className="relative border-t border-white/[0.07] px-5 py-8 text-center text-xs text-white/30">
        © 2026 OZLIND. Built for intelligent work.
      </footer>
    </main>
  );
}