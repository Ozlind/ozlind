import {
  ArrowRight,
  Bot,
  Code2,
  Github,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI Chat",
    text: "Fast, natural conversations with your AI companion.",
  },
  {
    icon: ImageIcon,
    title: "AI Image",
    text: "Create visuals from simple text prompts.",
  },
  {
    icon: Sparkles,
    title: "Photo Editor",
    text: "Enhance and transform your photos with AI.",
  },
  {
    icon: Code2,
    title: "Code Assistant",
    text: "Build, debug and understand code faster.",
  },
  {
    icon: Github,
    title: "GitHub Agent",
    text: "Work with your repositories from one workspace.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      {/* Navigation */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-glow">
            <Sparkles size={18} />
          </div>

          <span className="text-xl">OZLIND</span>
        </div>

        <button className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]">
          Get Started
        </button>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-20 text-center sm:px-8 sm:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[100px]" />

        <div className="relative">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/65">
            <Sparkles size={14} />
            Your All-in-One AI Companion
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-7xl">
            One intelligent workspace.

            <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
              Infinite possibilities.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            Chat, create, edit, code and automate — all inside one premium AI
            ecosystem.
          </p>

          <button className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-medium text-black transition hover:scale-[1.02]">
            Enter OZLIND
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 pb-20 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="group rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur transition hover:-translate-y-1 hover:border-violet-400/25 hover:bg-white/[0.055]"
          >
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
              <Icon size={21} />
            </div>

            <h2 className="text-lg font-medium">{title}</h2>

            <p className="mt-2 text-sm leading-6 text-white/45">
              {text}
            </p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] px-5 py-8 text-center text-xs text-white/30">
        © {new Date().getFullYear()} OZLIND. Built for the future of AI.
      </footer>
    </main>
  );
        }
