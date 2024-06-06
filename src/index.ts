import EventEmitter from 'events'
import type Keyv from 'keyv'
import { coalesceAsync } from './coalesce-async'
import { runIfFn } from './run-if-fn'
import { lt } from './lt'

export interface CreateCacheOptions {
  stores: Keyv[]
  ttl?: number
  refreshThreshold?: number
}

export type Events = {
  set: <T>(data: { key: string; value: T; error?: unknown }) => void
  del: (data: { key: string; error?: unknown }) => void
  clear: (error?: unknown) => void
  refresh: <T>(data: { key: string; value: T; error?: unknown }) => void
}

export const createCache = (options: CreateCacheOptions) => {
  const config = { ...options }

  if (!config.stores.length) throw new Error('At least one store is required')

  const eventEmitter = new EventEmitter()

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

  const set = async <T>(key: string, value: T, ttl?: number) => {
    try {
      await Promise.all(config.stores.map(async (store) => store.set(key, value, ttl ?? config.ttl)))
      eventEmitter.emit('set', { key, value })
      return value
    } catch (error) {
      eventEmitter.emit('set', { key, value, error })
      return Promise.reject(error)
    }
  }

  const del = async (key: string) => {
    try {
      await Promise.all(config.stores.map(async (store) => store.delete(key)))
      eventEmitter.emit('del', { key })
      return true
    } catch (error) {
      eventEmitter.emit('del', { key, error })
      return Promise.reject(error)
    }
  }

  const clear = async () => {
    try {
      await Promise.all(config.stores.map(async (store) => store.clear()))
      eventEmitter.emit('clear')
      return true
    } catch (error) {
      eventEmitter.emit('clear', error)
      return Promise.reject(error)
    }
  }

  const wrap = async <T>(
    key: string,
    fnc: () => T | Promise<T>,
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
          .then(async (result) => {
            try {
              await config.stores[i].set(key, result, ms)
              eventEmitter.emit('refresh', { key, value: result })
            } catch (error) {
              eventEmitter.emit('refresh', { key, value, error })
            }
          })
          .catch((error) => {
            eventEmitter.emit('refresh', { key, value, error })
          })
      }

      return value
    })
  }

  const on = <E extends keyof Events>(event: E, listener: Events[E]) => eventEmitter.addListener(event, listener)

  const off = <E extends keyof Events>(event: E, listener: Events[E]) => eventEmitter.removeListener(event, listener)

  return {
    get,
    set,
    del,
    clear,
    wrap,
    on,
    off,
  }
}
