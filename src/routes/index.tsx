import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, BarChart2, Bell, Zap } from "lucide-react"
import { guardHome } from "@/functions/guards"

export const Route = createFileRoute("/")({
  loader: () => guardHome(),
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <div className="max-w-xl mx-auto px-4 py-16 flex flex-col gap-16 flex-1">
        {/* Hero */}
        <div className="space-y-6 pt-8">
          <h1 className="text-4xl font-extrabold text-base-content tracking-tight leading-tight">
            TweetSip
          </h1>
          <p className="text-lg text-base-content/60 leading-relaxed">
            Track the accounts that matter. Get a daily AI briefing on what's moving, what's silent,
            and what you should do about it.
          </p>
          <Link to="/login" className="btn btn-neutral btn-lg gap-2 self-start">
            Get started <ArrowRight size={16} />
          </Link>
        </div>

        {/* Features */}
        <div className="space-y-4">
          {[
            {
              icon: <BarChart2 size={18} />,
              title: "Signal, not noise",
              desc: "AI reads the latest posts and scores engagement so you instantly know who's moving.",
            },
            {
              icon: <Zap size={18} />,
              title: "Briefings that act",
              desc: "Every account gets a moment summary and a tactical recommendation tailored to you.",
            },
            {
              icon: <Bell size={18} />,
              title: "Alerts when it counts",
              desc: "Get notified on strong signals and silence — before the window closes.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-base-100 rounded-box border border-base-200 p-5 flex gap-4"
            >
              <span className="text-base-content/40 mt-0.5 shrink-0">{f.icon}</span>
              <div>
                <p className="font-semibold text-base-content text-sm">{f.title}</p>
                <p className="text-sm text-base-content/50 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-base-content/30">
        TweetSip · Built on Cloudflare
      </div>
    </div>
  )
}
