import { defineMiddlewares, validateAndTransformQuery, validateAndTransformBody } from '@medusajs/framework'
import { StoreSearchCategoriesSchema } from './store/meilisearch/categories-hits/route'
import { StoreSearchProductsSchema } from './store/meilisearch/products-hits/route'
import { StoreProductsSchema } from './store/meilisearch/products/route'
import { StoreCategoriesSchema } from './store/meilisearch/categories/route'
import { AdminSearchCategoriesSchema } from './admin/meilisearch/categories-hits/route'
import { AdminSearchProductsSchema } from './admin/meilisearch/products-hits/route'

export default defineMiddlewares({
  routes: [
    {
      methods: ['GET'],
      matcher: '/store/meilisearch/categories-hits',
      middlewares: [validateAndTransformQuery(StoreSearchCategoriesSchema, {})],
    },
    {
      methods: ['GET'],
      matcher: '/store/meilisearch/products-hits',
      middlewares: [validateAndTransformQuery(StoreSearchProductsSchema, {})],
    },
    {
      methods: ['GET'],
      matcher: '/store/meilisearch/products',
      middlewares: [validateAndTransformQuery(StoreProductsSchema, {})],
    },
    {
      methods: ['GET'],
      matcher: '/store/meilisearch/categories',
      middlewares: [validateAndTransformQuery(StoreCategoriesSchema, {})],
    },
    {
      methods: ['POST'],
      matcher: '/admin/meilisearch/categories-hits',
      middlewares: [validateAndTransformBody(AdminSearchCategoriesSchema)],
    },
    {
      methods: ['POST'],
      matcher: '/admin/meilisearch/products-hits',
      middlewares: [validateAndTransformBody(AdminSearchProductsSchema)],
    },
  ],
})
