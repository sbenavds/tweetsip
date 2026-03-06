import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, BarChart2, Bell, Zap } from "lucide-react"
import { guardHome } from "@/functions/guards"

export const Route = createFileRoute("/")({
  loader: () => guardHome(),
  component: LandingPage,
})

const FEATURES = [
  {
    icon: <BarChart2 size={20} />,
    title: "Signal, not noise",
    desc: "AI scores engagement so you instantly know who's moving and who's gone quiet.",
  },
  {
    icon: <Zap size={20} />,
    title: "Briefings that act",
    desc: "Every account gets a moment summary and a tactical recommendation tailored to you.",
  },
  {
    icon: <Bell size={20} />,
    title: "Alerts when it counts",
    desc: "Get notified on strong signals and silence — before the window closes.",
  },
]

function LandingPage() {
  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {/* Nav */}
      <nav className="w-full px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <span className="font-extrabold text-base-content tracking-tight">TweetSip</span>
        <Link to="/login" className="btn btn-neutral btn-sm gap-1.5">
          Get started <ArrowRight size={13} />
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center space-y-6">
        <h1 className="text-5xl font-extrabold text-base-content tracking-tight leading-tight">
          Your Twitter intelligence
          <br className="hidden sm:block" /> briefing, daily.
        </h1>
        <p className="text-lg text-base-content/50 max-w-lg mx-auto leading-relaxed">
          Track the accounts that matter. Get AI-powered briefings on what's moving, what's silent,
          and exactly what to do about it.
        </p>
        <Link to="/login" className="btn btn-neutral btn-lg gap-2 mx-auto">
          Get started free <ArrowRight size={16} />
        </Link>
      </section>

      {/* Hero image */}
      <section className="max-w-4xl mx-auto px-6 pb-20 w-full">
        <div className="relative rounded-2xl overflow-hidden shadow-lg">
          <img
            src="/hero.png"
            alt="Accounts flow into AI, AI generates a summarized digest"
            className="w-full"
          />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-base-200 via-base-200/60 to-transparent" />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-20 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-base-100 rounded-box border border-base-200 p-6 space-y-3"
            >
              <span className="text-base-content/40">{f.icon}</span>
              <p className="font-semibold text-base-content">{f.title}</p>
              <p className="text-sm text-base-content/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24 w-full text-center space-y-4">
        <h2 className="text-2xl font-extrabold text-base-content">Ready to sip smarter?</h2>
        <p className="text-base-content/50 text-sm">Free to start. No credit card required.</p>
        <Link to="/login" className="btn btn-neutral btn-lg gap-2 mx-auto">
          Get started <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <div className="mt-auto text-center py-6 text-xs text-base-content/30">
        TweetSip · Built on Cloudflare
      </div>
    </div>
  )
}
