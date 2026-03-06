import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ThemePref = "tweetsip" | "tweetsip-dark" | "system"

interface ThemeStore {
  pref: ThemePref
  cycle: () => void
}

function resolveTheme(pref: ThemePref): string {
  if (pref !== "system") return pref
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "tweetsip-dark" : "tweetsip"
}

function applyTheme(pref: ThemePref) {
  document.documentElement.setAttribute("data-theme", resolveTheme(pref))
}

const ORDER: ThemePref[] = ["tweetsip", "tweetsip-dark", "system"]

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      pref: "system",
      cycle() {
        const next = ORDER[(ORDER.indexOf(get().pref) + 1) % ORDER.length]
        set({ pref: next })
        applyTheme(next)
      },
    }),
    {
      name: "theme",
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.pref)
      },
    }
  )
)
