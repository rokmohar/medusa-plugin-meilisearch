import {
  defineMiddlewares,
  validateAndTransformQuery,
  validateAndTransformBody,
  MedusaRequest,
  MedusaResponse,
  MedusaNextFunction,
} from '@medusajs/framework'
import {
  authenticate,
  filterByValidSalesChannels,
  applyDefaultFilters,
  normalizeDataForContext,
  setPricingContext,
  setTaxContext,
  clearFiltersByKey,
  maybeApplyLinkFilter,
  ContainerRegistrationKeys,
  ProductStatus,
  isPresent,
  StoreGetProductsParams,
  listProductQueryConfig,
  StoreProductCategoriesParams,
  listProductCategoryConfig,
} from './utils/medusa'
import { StoreSearchCategoriesSchema } from './store/meilisearch/categories-hits/route'
import { StoreSearchProductsSchema } from './store/meilisearch/products-hits/route'
import { AdminSearchCategoriesSchema } from './admin/meilisearch/categories-hits/route'
import { AdminSearchProductsSchema } from './admin/meilisearch/products-hits/route'
import './types'

/**
 * Meilisearch-only params are not part of the native Medusa validators (which are
 * strict and reject unknown keys). Pull them off `req.query` BEFORE the native
 * `validateAndTransformQuery` runs, and stash them on `req.meiliParams` for the
 * route handler. Express 4: `req.query` is a mutable plain object.
 */
function extractMeiliParams(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const q = req.query
  const semanticRatioRaw = q.semanticRatio

  req.meiliParams = {
    query: typeof q.query === 'string' ? q.query : undefined,
    language: typeof q.language === 'string' ? q.language : undefined,
    semanticSearch: q.semanticSearch === 'true',
    semanticRatio: typeof semanticRatioRaw === 'string' && semanticRatioRaw !== '' ? Number(semanticRatioRaw) : 0.5,
  }

  delete q.query
  delete q.language
  delete q.semanticSearch
  delete q.semanticRatio

  next()
}

/**
 * Port of the native `/store/products` `applyMaybeLinkFilterIfNecessary` middleware.
 * Sales-channel link filtering is only applied when more than one sales channel
 * exists; otherwise the `sales_channel_id` filter is dropped (same as native).
 *
 * The native index-engine early-return is intentionally omitted: it only applies
 * when the (opt-in) index engine feature flag is enabled, in which case native uses
 * a different query path entirely. These routes always use `query.graph`, so the
 * default-flag-off behaviour is the correct parity target.
 */
async function applyMaybeLinkFilterIfNecessary(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelsQueryRes = await query.graph({
    entity: 'sales_channels',
    fields: ['id'],
    pagination: { skip: 0, take: 1 },
  })
  const salesChannelCount = salesChannelsQueryRes.metadata?.count ?? 0

  if (!(salesChannelCount > 1)) {
    delete req.filterableFields['sales_channel_id']

    return next()
  }

  return maybeApplyLinkFilter({
    entryPoint: 'product_sales_channel',
    resourceId: 'product_id',
    filterableField: 'sales_channel_id',
  })(req, res, next)
}

export default defineMiddlewares({
  routes: [
    // Mirrors native `/store/products` middleware stack so the custom endpoint
    // behaves identically (auth, sales channels, published default, pricing/tax).
    {
      methods: ['GET'],
      matcher: '/store/meilisearch/products',
      middlewares: [
        authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true }),
        extractMeiliParams,
        validateAndTransformQuery(StoreGetProductsParams, listProductQueryConfig),
        filterByValidSalesChannels(),
        applyMaybeLinkFilterIfNecessary,
        applyDefaultFilters({
          status: ProductStatus.PUBLISHED,
          categories: (filters: Record<string, unknown>) => {
            const categoryIds = filters.category_id

            delete filters.category_id

            if (!isPresent(categoryIds)) {
              return
            }

            return { id: categoryIds, is_internal: false, is_active: true }
          },
        }),
        normalizeDataForContext(),
        setPricingContext(),
        setTaxContext(),
        clearFiltersByKey(['region_id', 'country_code', 'province', 'cart_id']),
      ],
    },
    // Mirrors native `/store/product-categories` (validate/transform only).
    {
      methods: ['GET'],
      matcher: '/store/meilisearch/categories',
      middlewares: [
        extractMeiliParams,
        validateAndTransformQuery(StoreProductCategoriesParams, listProductCategoryConfig),
      ],
    },
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
