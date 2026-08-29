import * as React from "react"

/** Phones + tablets (iPad) — sidebar uses overlay hamburger below this width */
export const COMPACT_VIEWPORT_MAX_WIDTH = 1023

const COMPACT_VIEWPORT_QUERY = `(max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(COMPACT_VIEWPORT_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.innerWidth <= COMPACT_VIEWPORT_MAX_WIDTH
}

/** Server + hydration snapshot — always desktop layout to avoid mismatch */
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function isCompactViewport() {
  if (typeof window === "undefined") return false
  return window.innerWidth <= COMPACT_VIEWPORT_MAX_WIDTH
}
