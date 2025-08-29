import { defineMiddlewares, validateAndTransformQuery, validateAndTransformBody } from '@medusajs/framework'
import { StoreSearchProductsSchema } from './store/meilisearch/hits/route'
import { AdminSearchProductsSchema } from './admin/meilisearch/hits/route'

export default defineMiddlewares({
  routes: [
    {
      methods: ['GET'],
      matcher: '/store/meilisearch/hits',
      middlewares: [validateAndTransformQuery(StoreSearchProductsSchema, {})],
    },
    {
      methods: ['POST'],
      matcher: '/admin/meilisearch/hits',
      middlewares: [validateAndTransformBody(AdminSearchProductsSchema)],
    },
  ],
})
