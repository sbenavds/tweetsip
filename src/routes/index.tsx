import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-base-content/40 text-sm">TweetSip</p>
    </div>
  )
}
