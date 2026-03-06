const X_API_BASE = "https://api.x.com/2"

type XPost = {
  id: string
  text: string
  public_metrics: {
    like_count: number
    repost_count: number
    reply_count: number
  }
  created_at: string
}

type XUser = {
  id: string
  name: string
  username: string
  profile_image_url?: string
}

type XTimelineResponse = {
  data?: XPost[]
  includes?: { users?: XUser[] }
  meta?: { newest_id?: string; oldest_id?: string; result_count?: number }
}

export async function fetchUserByHandle(
  handle: string,
  bearerToken: string
): Promise<XUser | null> {
  const username = handle.replace(/^@/, "")
  const url = `${X_API_BASE}/users/by/username/${username}?user.fields=profile_image_url,name`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  })

  const json = await res.json<{ data?: XUser }>()
  console.log("[x-api] fetchUserByHandle", handle, res.status, JSON.stringify(json))

  if (!res.ok) return null
  return json.data ?? null
}

export async function fetchUserTimeline(
  xUserId: string,
  bearerToken: string,
  maxResults = 5
): Promise<XPost[]> {
  const params = new URLSearchParams({
    max_results: String(maxResults),
    "tweet.fields": "public_metrics,created_at",
    exclude: "retweets,replies",
  })

  const url = `${X_API_BASE}/users/${xUserId}/tweets?${params}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  })

  const json = await res.json<XTimelineResponse>()
  console.log("[x-api] fetchUserTimeline", xUserId, res.status, JSON.stringify(json))

  if (!res.ok) return []
  return json.data ?? []
}
