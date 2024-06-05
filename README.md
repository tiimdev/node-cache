![Logo](./logo.png)

# @tiimdev/node-cache
[![test](https://github.com/tiimdev/node-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/tiimdev/node-cache/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/tiimdev/node-cache)](https://github.com/tiimdev/node-cache/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/dm/@tiimdev/node-cache)](https://npmjs.com/package/@tiimdev/node-cache)
![npm](https://img.shields.io/npm/v/@tiimdev/node-cache)

# Simple and fast NodeJS caching module.
A cache module for NodeJS that allows easy wrapping of functions in cache, tiered caches, and a consistent interface.
Folk and modify from [cache-manager](https://github.com/jaredwray/cache-manager).
- Made with Typescript and compatible with [ESModules](https://nodejs.org/docs/latest-v14.x/api/esm.html).
- Easy way to wrap any function in cache, supports a mechanism to refresh expiring cache keys in background.
- Tiered caches -- data gets stored in each cache and fetched from the highest priority cache(s) first.
- Use with any [Keyv](https://keyv.org/)-compatible storage adapter.
- 100% test coverage via [vitest](https://github.com/vitest-dev/vitest).

## Table of Contents
* [Installation](#installation)
* [Usage Examples](#usage-examples)
* [Contribute](#contribute)
* [License](#license)

## Installation

```sh
yarn add @tiimdev/node-cache
```

By default, everything is stored in memory; you can optionally also install a storage adapter; choose one from any of the storage adapters supported by Keyv:

```sh
yarn add @keyv/redis
yarn add @keyv/memcache
yarn add @keyv/mongo
yarn add @keyv/sqlite
yarn add @keyv/postgres
yarn add @keyv/mysql
yarn add @keyv/etcd
```

Please read [Keyv document](https://keyv.org/docs/) for more information.

## Usage Examples

### Initialize
```typescript
import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'
import KeyvSqlite from '@keyv/sqlite'
import { createCache } from '@tiimdev/node-cache';

const cache = createCache({
  stores: [
    // Memory store
    new Keyv(),

    // Redis store
    new KeyvRedis('redis://user:pass@localhost:6379'),

    // Sqlite store
    new KeyvSqlite('cache.db'),
  ],
  ttl: 10000,
  refreshThreshold: 3000,
  onBackgroundRefreshError: (key, error) => {
    /* log or otherwise handle error */
  },
})
```
#### Options
- **stores**: Keyv[] (required)

    List of Keyv instance. Please refer to the [Keyv document](https://keyv.org/docs/#3.-create-a-new-keyv-instance) for more information.
- **ttl**: number (optional)

    The time to live in milliseconds. This is the maximum amount of time that an item can be in the cache before it is removed.
- **refreshThreshold**: number (optional)

    If the remaining TTL is less than **refreshThreshold**, the system will update the value asynchronously in background.
- **onBackgroundRefreshError**: (key: string, error: unknow) => void (optional)

    A function to handle errors that occur during background refresh.

### > set(key, value, [ttl])
Sets a key value pair. It is possible to define a ttl (in miliseconds). An error will be throw on any failed

```ts
await cache.set('key-1', 'value 1');

// expires after 5 seconds
await cache.set('key 2', 'value 2', 5000);
```

### > get(key)
Gets a saved value from the cache. Returns a null if not found or expired. If the value was found it returns the value.

```ts
await cache.set('key', 'value');

await cache.get('key');
// => value

await cache.get('foo');
// => null
```

### > del(key)
Delete a key, an error will be throw on any failed.

```ts
await cache.set('key', 'value');

await cache.get('key');
// => value

await cache.del('key');

await cache.get('key');
// => null
```

### > wrap(key, fn: async () => value, [ttl], [refreshThreshold])
Wraps a function in cache. The first time the function is run, its results are stored in cache so subsequent calls retrieve from cache instead of calling the function.

If `refreshThreshold` is set and the remaining TTL is less than `refreshThreshold`, the system will update the value asynchronously. In the meantime, the system will return the old value until expiration.

```typescript
await cache.wrap('key', () => 1, 5000, 3000)
// call function then save the result to cache
// =>  1

await cache.wrap('key', () => 2, 5000, 3000)
// return data from cache, function will not be called again
// => 1

// wait 3 seconds
await sleep(3000)

await cache.wrap('key', () => 2, 5000, 3000)
// return data from cache, call function in background and save the result to cache
// =>  1

await cache.wrap('key', () => 3, 5000, 3000)
// return data from cache, function will not be called
// =>  2

await cache.wrap('error', () => {
  throw new Error('failed')
})
// onBackgroundRefreshError will be run.
// => null
```
**NOTES:**

* The store that will be checked for refresh is the one where the key will be found first (highest priority).
* If the threshold is low and the worker function is slow, the key may expire and you may encounter a racing condition with updating values.
* If no `ttl` is set for the key, the refresh mechanism will not be triggered.

See unit tests in [`test/cache.test.ts`](./test/cache.test.ts) for more information.

## Contribute

If you would like to contribute to the project, please read how to contribute here [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Released under the [MIT license](./LICENSE).