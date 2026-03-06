import { queryOptions } from "@tanstack/react-query"
import { getFeed } from "@/functions/feed"

export const feedQueryOptions = () =>
  queryOptions({
    queryKey: ["feed"] as const,
    queryFn: () => getFeed(),
  })
