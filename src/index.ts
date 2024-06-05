import type Keyv from 'keyv'
import { coalesceAsync } from './coalesce-async'
import { runIfFn } from './run-if-fn'
import { lt } from './lt'

export interface CreateCacheOptions {
  stores: Keyv[]
  ttl?: number
  refreshThreshold?: number
  onBackgroundRefreshError?: (key: string, error: unknown) => void
}

export const createCache = (options: CreateCacheOptions) => {
  const config = { ...options }

  const get = async <T>(key: string) => {
    for (const store of config.stores) {
      try {
        const data = await store.get(key)
        if (data !== undefined) return data as T
      } catch {
        //
      }
    }

    return null
  }

  const set = async <T>(key: string, data: T, ttl?: number) => {
    await Promise.all(config.stores.map(async (store) => store.set(key, data, ttl ?? config.ttl)))
  }

  const del = async (key: string) => {
    await Promise.all(config.stores.map(async (store) => store.delete(key)))
  }

  const clear = async () => {
    await Promise.all(config.stores.map(async (store) => store.clear()))
  }

  const wrap = async <T>(
    key: string,
    fnc: () => Promise<T>,
    ttl?: number | ((value: T) => number),
    refreshThreshold?: number
  ): Promise<T> => {
    return coalesceAsync(key, async () => {
      let value: T | undefined
      let i = 0
      let remainingTtl: number | undefined

      for (; i < config.stores.length; i++) {
        try {
          const data = await config.stores[i].get(key, { raw: true })
          if (data !== undefined) {
            value = data.value
            if (typeof data.expires === 'number') {
              remainingTtl = Math.max(0, data.expires - Date.now())
            }

            break
          }
        } catch {
          //
        }
      }

      if (value === undefined) {
        const result = await fnc()
        await set(key, result, runIfFn(ttl, result) ?? config.ttl)
        return result
      }

      const ms = runIfFn(ttl, value) ?? config.ttl

      await Promise.all(config.stores.slice(0, i).map(async (cache) => cache.set(key, value, ms)))

      if (lt(remainingTtl, refreshThreshold ?? config.refreshThreshold)) {
        coalesceAsync(`+++${key}`, fnc)
          .then(async (result) => config.stores[i].set(key, result, ms))
          .catch((error) => {
            config.onBackgroundRefreshError?.(key, error)
          })
      }

      return value
    })
  }

  return {
    get,
    set,
    del,
    clear,
    wrap,
    config,
  }
}
