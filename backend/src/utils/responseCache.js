/**
 * In-memory response cache with TTL and in-flight deduplication.
 * Avoids repeated remote MySQL round-trips for hot read endpoints.
 */
export function createResponseCache(defaultTtlMs = 60 * 1000) {
  const cache = new Map()
  const inflight = new Map()

  function isFresh(entry, ttlMs) {
    return entry && Date.now() - entry.at < ttlMs
  }

  return {
    async get(key, fetchFn, ttlMs = defaultTtlMs) {
      const entry = cache.get(key)
      if (isFresh(entry, ttlMs)) {
        return entry.data
      }

      const pending = inflight.get(key)
      if (pending) return pending

      const promise = Promise.resolve()
        .then(fetchFn)
        .then((data) => {
          cache.set(key, { data, at: Date.now() })
          inflight.delete(key)
          return data
        })
        .catch((err) => {
          inflight.delete(key)
          throw err
        })

      inflight.set(key, promise)
      return promise
    },

    peek(key, ttlMs = defaultTtlMs) {
      const entry = cache.get(key)
      return isFresh(entry, ttlMs) ? entry.data : null
    },

    set(key, data) {
      cache.set(key, { data, at: Date.now() })
    },

    clear() {
      cache.clear()
      inflight.clear()
    },
  }
}
