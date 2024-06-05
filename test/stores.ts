import Keyv from 'keyv'
import { createCache } from '../src'

const keyv1 = new Keyv()
export const cache1 = createCache({
  stores: [keyv1],
})

const keyv2 = new Keyv()
keyv2.get = () => {
  throw new Error('failed')
}
export const cache2 = createCache({
  stores: [keyv2],
})
