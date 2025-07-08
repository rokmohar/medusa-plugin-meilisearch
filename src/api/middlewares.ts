import { defineMiddlewares, validateAndTransformQuery } from '@medusajs/framework'
import { StoreSearchProductsSchema } from './store/meilisearch/hits/route'

export default defineMiddlewares({
  routes: [
    {
      methods: ['GET'],
      matcher: '/store/meilisearch/hits',
      middlewares: [validateAndTransformQuery(StoreSearchProductsSchema, {})],
    },
  ],
})
