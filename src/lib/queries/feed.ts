import { queryOptions } from "@tanstack/react-query"
import { getDemoFeed, getFeed } from "@/functions/feed"

export const feedQueryOptions = () =>
  queryOptions({
    queryKey: ["feed"] as const,
    queryFn: () => getFeed(),
  })

export const demoFeedQueryOptions = () =>
  queryOptions({
    queryKey: ["demo-feed"] as const,
    queryFn: () => getDemoFeed(),
    staleTime: 5 * 60 * 1000,
  })
