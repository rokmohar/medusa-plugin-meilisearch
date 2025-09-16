import Medusa from '@medusajs/js-sdk'

export const sdk = new Medusa({
  baseUrl: __BACKEND_URL__ || '/',
  auth: {
    type: 'session',
  },
})
