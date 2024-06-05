# @tiimdev/node-cache
[![test](https://github.com/tiimdev/node-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/tiimdev/node-cache/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/tiimdev/node-cache)](https://github.com/tiimdev/node-cache/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/dm/@tiimdev/node-cache)](https://npmjs.com/package/@tiimdev/node-cache)
![npm](https://img.shields.io/npm/v/@tiimdev/node-cache)

# Flexible NodeJS cache module with Keyv

A cache module for nodejs that allows easy wrapping of functions in cache, tiered caches, and a consistent interface.

This package is another version of `cache-manager` build on top of [Keyv](https://keyv.org/).

[Keyv](https://keyv.org/) provides a consistent interface for key-value storage across multiple backends via storage adapters. It supports TTL based expiry, making it suitable as a cache or a persistent key-value store. 

## Table of Contents
* [Features](#features)
* [Installation](#installation)
* [Usage Examples](#usage-examples)
* [Cache Options](#cache-options)
* [Contribute](#contribute)
* [License](#license)

## Features
- Made with Typescript and compatible with [ESModules](https://nodejs.org/docs/latest-v14.x/api/esm.html)
- Easy way to wrap any function in cache.
- Tiered caches -- data gets stored in each cache and fetched from the highest priority cache(s) first.
- Use any Keyv-compatible storage adapter.
- 100% test coverage via [vitest](https://github.com/vitest-dev/vitest).

## Installation

```sh
yarn add @tiimdev/node-cache
```

By default, everything is stored in memory; you can optionally also install a storage adapter; choose one from the following:

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
})

await cache.set('foo', 'bar', 5000);

await cache.get('foo')
// >> "bar"

await cache.del('foo');

await cache.get('foo')
// >> null

const getUser = (id: string) => new Promise.resolve({ id, name: 'Bob' });

const userId = '123';

await cache.wrap(userId, () => getUser(userId), 5000)
// >> { id: '123', name: 'Bob' }
```

See unit tests in [`test/cache.test.ts`](./test/cache.test.ts) for more information.

## Cache Options
The `createCache` function accepts an options object as the first parameter. The following options are available:

### stores: Keyv[]
List of Keyv instance. Please refer to the [Keyv document](https://keyv.org/docs/#3.-create-a-new-keyv-instance) for more information.

### ttl: number (optional)
The time to live in milliseconds. This is the maximum amount of time that an item can be in the cache before it is removed.

### refreshThreshold: number (optional)
`@tiimdev/node-cache` supports a mechanism to refresh expiring cache keys in background when using the `wrap` function.
This is done by adding a `refreshThreshold` attribute while creating the caching store 
```typescript
const cache = createCache({
  stores: [new Keyv()],
  ttl: 10000,
  refreshThreshold: 3000,
  
  /* optional, but if not set, background refresh error will be an unhandled
   * promise rejection, which might crash your node process */
  onBackgroundRefreshError: (key, error) => { /* log or otherwise handle error */ }
})

await cache.wrap(
  'unique-key',
  () => {
    // fetch data ...
    return { id: 1 }
  },
)
```
or passing it to the `wrap` function.
```typescript
await cache.wrap(
  'unique-key',
  () => {
    // fetch data ...
    return { id: 1 }
  },
  10000, // ttl
  3000   // refreshThreshold
)
```

If `refreshThreshold` is set and after retrieving a value from cache the TTL will be checked.  
If the remaining TTL is less than `refreshThreshold`, the system will update the value asynchronously,  
following same rules as standard fetching. In the meantime, the system will return the old value until expiration.

**NOTES:**

* In case of multistore, the store that will be checked for refresh is the one where the key will be found first (highest priority).
* If the threshold is low and the worker function is slow, the key may expire and you may encounter a racing condition with updating values.
* The background refresh mechanism currently does not support providing multiple keys to `wrap` function.
* If no `ttl` is set for the key, the refresh mechanism will not be triggered.

### onBackgroundRefreshError: (key: string, error: unknow) => void (optional)
A function to handle errors that occur during background refresh.

## Contribute

If you would like to contribute to the project, please read how to contribute here [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Released under the [MIT license](./LICENSE).