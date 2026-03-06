import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, BarChart2, Bell, Zap } from "lucide-react"
import { guardHome } from "@/functions/guards"

export const Route = createFileRoute("/")({
  loader: () => guardHome(),
  component: LandingPage,
})

const FEATURES = [
  {
    icon: <BarChart2 size={16} />,
    title: "Signal, not noise",
    desc: "AI scores engagement so you instantly see who's surging and who's gone quiet.",
  },
  {
    icon: <Zap size={16} />,
    title: "Briefings that act",
    desc: "Every account gets a summary and a tactical recommendation — written for you.",
  },
  {
    icon: <Bell size={16} />,
    title: "Alerts before the window closes",
    desc: "Strong signal or 48h silence — you hear about it before everyone else does.",
  },
]

function LandingPage() {
  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {/* Nav */}
      <nav className="max-w-4xl mx-auto w-full px-6 py-5 flex items-center justify-between">
        <span className="text-lg font-bold text-base-content tracking-tight">TweetSip</span>
        <Link to="/login" className="btn btn-neutral btn-sm gap-1.5">
          Get started <ArrowRight size={13} />
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-10 text-center space-y-5">
        <h1 className="text-5xl font-extrabold text-base-content tracking-tight leading-[1.1]">
          Stay ahead of every
          <br className="hidden sm:block" /> account that matters.
        </h1>
        <p className="text-lg text-base-content/50 max-w-md mx-auto leading-relaxed">
          TweetSip tracks your key X accounts and delivers daily AI briefings — who's surging, who's
          silent, and what to do about it.
        </p>
        <Link to="/login" className="btn btn-neutral btn-lg gap-2 mx-auto">
          Get started free <ArrowRight size={16} />
        </Link>
      </section>

      {/* Hero image — no shadow, gradient blends into page */}
      <section className="max-w-4xl mx-auto px-6 pb-16 w-full">
        <div className="relative rounded-2xl overflow-hidden">
          <img
            src="/hero.png"
            alt="Tracked accounts flow into AI, which generates a summarized email digest"
            className="w-full"
          />
          <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-base-200 to-transparent" />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-16 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-base-100 rounded-box border border-base-200 p-5 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-base-content/40 shrink-0">{f.icon}</span>
                <p className="font-semibold text-base-content text-sm">{f.title}</p>
              </div>
              <p className="text-sm text-base-content/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24 w-full text-center space-y-3">
        <h2 className="text-2xl font-bold text-base-content">
          Track five accounts.
          <br />
          Get your first briefing in minutes.
        </h2>
        <p className="text-sm text-base-content/40">Free to start. No credit card required.</p>
        <Link to="/login" className="btn btn-neutral btn-lg gap-2 mx-auto">
          Get started <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <div className="mt-auto text-center py-6 text-xs text-base-content/30">
        © {new Date().getFullYear()} TweetSip
      </div>
    </div>
  )
}
