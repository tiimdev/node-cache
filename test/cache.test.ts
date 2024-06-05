import Keyv from 'keyv'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { faker } from '@faker-js/faker'
import { createCache } from '../src'
import { cache1, cache2 } from './stores'
import { sleep } from './sleep'

const ttl = 500
const data = { key: '', value: '' }

describe('cache', () => {
  beforeEach(async () => {
    data.key = faker.string.alpha(20)
    data.value = faker.string.sample()
  })

  describe('init', () => {
    it('should return error due to stores is empty', async () => {
      expect(() => createCache({ stores: [] })).toThrowError()
    })
  })

  describe('get() and set()', () => {
    it('should return value', async () => {
      await cache1.set(data.key, 'string')
      await expect(cache1.get(data.key)).resolves.toEqual('string')

      await cache1.set(data.key, 1)
      await expect(cache1.get(data.key)).resolves.toEqual(1)

      await cache1.set(data.key, true)
      await expect(cache1.get(data.key)).resolves.toEqual(true)

      const o = { id: 1, name: 'test' }
      await cache1.set(data.key, o)
      await expect(cache1.get(data.key)).resolves.toEqual(o)
    })

    it('should return null due to expiry', async () => {
      await cache1.set(data.key, data.value, ttl)
      await sleep(ttl + 100)
      await expect(cache1.get(data.key)).resolves.toEqual(null)
    })

    it('should return null due to get error', async () => {
      await cache2.set(data.key, data.value)
      await expect(cache2.get(data.key)).resolves.toEqual(null)
    })
  })

  describe('del()', () => {
    it('delete data from cache', async () => {
      await cache1.set(data.key, data.value)
      await expect(cache1.get(data.key)).resolves.toEqual(data.value)
      await cache1.del(data.key)
      await expect(cache1.get(data.key)).resolves.toBeNull()
    })
  })

  describe('clear()', () => {
    it('delete all cache data', async () => {
      const arr = [1, 2, 3]
      for (const index of arr) {
        await cache1.set(data.key + index, data.value + index)
      }
      await cache1.clear()
      for (const index of arr) {
        await expect(cache1.get(data.key + index)).resolves.toBeNull()
      }
    })
  })

  describe('wrap()', () => {
    it('set the ttl to be milliseconds', async () => {
      await cache1.wrap(data.key, async () => data.value, ttl)
      await expect(cache1.get(data.key)).resolves.toEqual(data.value)
      await sleep(ttl + 100)
      await expect(cache1.get(data.key)).resolves.toBeNull()
    })

    it('set the ttl to be a function', async () => {
      // Confirm the cache is empty.
      await expect(cache1.get(data.key)).resolves.toBeNull()

      const getTtlFunc = vi.fn(() => ttl)
      await cache1.wrap(data.key, async () => data.value, getTtlFunc)
      await expect(cache1.get(data.key)).resolves.toEqual(data.value)
      expect(getTtlFunc).toHaveBeenCalledTimes(1)
    })

    it('calls function to fetch value on cache miss', async () => {
      const getValue = vi.fn().mockResolvedValue(data.value)

      // Confirm the cache is empty.
      await expect(cache1.get(data.key)).resolves.toBeNull()

      // The first request will populate the cache.
      await expect(cache1.wrap(data.key, getValue, ttl)).resolves.toEqual(data.value)
      await expect(cache1.get(data.key)).resolves.toEqual(data.value)
      expect(getValue).toHaveBeenCalledTimes(1)

      // The second request will return the cached value.
      getValue.mockClear()
      await expect(cache1.wrap(data.key, getValue, ttl)).resolves.toEqual(data.value)
      await expect(cache1.get(data.key)).resolves.toEqual(data.value)
      expect(getValue).toHaveBeenCalledTimes(0)

      // Expired, call the generator function.
      await sleep(ttl + 100)
      await expect(cache1.wrap(data.key, getValue, ttl)).resolves.toEqual(data.value)
      expect(getValue).toHaveBeenCalledTimes(1)
    })

    it('does not call fn to fetch value on cache hit', async () => {
      const getValue = vi.fn().mockResolvedValue(data.value)

      // Confirm the cache is contains the value.
      await cache1.set(data.key, data.value, ttl)
      await expect(cache1.get(data.key)).resolves.toEqual(data.value)

      // Will find the cached value and not call the generator function.
      await expect(cache1.wrap(data.key, getValue, ttl)).resolves.toEqual(data.value)
      await expect(cache1.get(data.key)).resolves.toEqual(data.value)
      expect(getValue).toHaveBeenCalledTimes(0)

      // Expired, call the generator function.
      await sleep(ttl + 100)
      await expect(cache1.wrap(data.key, getValue, ttl)).resolves.toEqual(data.value)
      expect(getValue).toHaveBeenCalledTimes(1)
    })

    it('calls fn once to fetch value on cache miss when invoked multiple times', async () => {
      const getValue = vi.fn().mockResolvedValue(data.value)

      // Confirm the cache is empty.
      await expect(cache1.get(data.key)).resolves.toBeNull()

      // Simulate several concurrent requests for the same value.
      const arr = Array(10).fill(null)
      const results = await Promise.allSettled(arr.map(() => cache1.wrap(data.key, getValue, ttl)))

      // Assert that the function was called exactly once.
      expect(getValue).toHaveBeenCalledTimes(1)

      // Assert that all requests resolved to the same value.
      for (const result of results) {
        expect(result).toMatchObject({
          status: 'fulfilled',
          value: data.value,
        })
      }
    })

    it('should allow dynamic refreshThreshold on wrap function', async () => {
      const config = { ttl: 2000, refreshThreshold: 1000 }

      // 1st call should be cached
      expect(await cache1.wrap(data.key, async () => 0, config.ttl, config.refreshThreshold)).toEqual(0)
      await sleep(1001)
      // Background refresh, but stale value returned
      expect(await cache1.wrap(data.key, async () => 1, config.ttl, config.refreshThreshold)).toEqual(0)
      // New value in cache
      expect(await cache1.wrap(data.key, async () => 2, config.ttl, config.refreshThreshold)).toEqual(1)

      await sleep(1001)
      // No background refresh with the new override params
      expect(await cache1.wrap(data.key, async () => 3, undefined, 500)).toEqual(1)
      await sleep(500)
      // Background refresh, but stale value returned
      expect(await cache1.wrap(data.key, async () => 4, undefined, 500)).toEqual(1)
      expect(await cache1.wrap(data.key, async () => 5, undefined, 500)).toEqual(4)
    })

    it('on background refresh error', async () => {
      const onBackgroundRefreshError = vi.fn()
      const cache = createCache({
        stores: [new Keyv()],
        onBackgroundRefreshError,
      })

      const refreshThreshold = ttl / 2
      expect(await cache.wrap(data.key, async () => 'ok', ttl, refreshThreshold)).toEqual('ok')
      expect(onBackgroundRefreshError).not.toHaveBeenCalled()

      await sleep(ttl - refreshThreshold)
      const error = new Error('failed')
      expect(
        await cache.wrap(
          data.key,
          async () => {
            throw error
          },
          ttl,
          refreshThreshold
        )
      ).toEqual('ok') // Previous successful value returned
      expect(onBackgroundRefreshError).toBeCalledTimes(1)
      expect(onBackgroundRefreshError).toHaveBeenCalledWith(data.key, error)
    })

    it('fn / store get error', async () => {
      const error = new Error('failed')
      const getError = vi.fn().mockRejectedValue(error)
      const getValue = vi.fn().mockResolvedValue(data.value)

      // Func error
      await expect(cache1.wrap(data.key, getValue, ttl)).resolves.toEqual(data.value)
      await expect(cache1.wrap(data.key, getValue, ttl)).resolves.toEqual(data.value)
      expect(getValue).toBeCalledTimes(1)
      await sleep(ttl + 100)
      await expect(cache1.wrap(data.key, getError, ttl)).rejects.toBe(error)
      expect(getError).toBeCalledTimes(1)

      // Store get error
      getValue.mockClear()
      await expect(cache2.wrap(data.key, getValue)).resolves.toEqual(data.value)
      await expect(cache2.wrap(data.key, getValue)).resolves.toEqual(data.value)
      await expect(cache2.wrap(data.key, getValue)).resolves.toEqual(data.value)
      expect(getValue).toBeCalledTimes(3)
    })
  })
})
