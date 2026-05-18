import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ProductDTO } from '@medusajs/types'
import { Hit } from 'meilisearch'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'
import {
  ContainerRegistrationKeys,
  QueryContext,
  isPresent,
  wrapVariantsWithInventoryQuantityForSalesChannel,
  wrapProductsWithTaxPrices,
} from '../../../utils/medusa'
import '../../../types'

export interface ProductsResponse {
  products: ProductDTO[]
  count: number
  limit?: number
  offset?: number
}

/**
 * Behaves like the native `/store/products` route. The native middleware stack
 * (see ../../../middlewares.ts) populates `req.queryConfig`, `req.filterableFields`,
 * `req.pricingContext` and `req.taxContext`. When a Meilisearch `query`/`semanticSearch`
 * is present, Meilisearch supplies the candidate product ids + ranking and that id set
 * is intersected into the native filters; everything else (fields, filters, pricing,
 * tax, inventory_quantity) is handled exactly as native.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse<ProductsResponse>) {
  const meili = req.meiliParams ?? { semanticSearch: false, semanticRatio: 0.5 }
  const isSearch = Boolean(meili.query ?? meili.semanticSearch)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  const { fields, pagination } = req.queryConfig
  const filters = req.filterableFields
  const limit = pagination.take
  const offset = pagination.skip

  // `variants.inventory_quantity` is a virtual field that `query.graph` cannot resolve.
  // Native strips it from the fields and post-computes it. Mirror that here.
  const allFields: string[] = [...fields]
  const withInventoryQuantity = allFields.some((f) => {
    return f.includes('variants.inventory_quantity')
  })
  const graphFields = withInventoryQuantity
    ? allFields.filter((f) => {
        return !f.includes('variants.inventory_quantity')
      })
    : allFields

  let productIds: string[] = []
  let totalCount = 0

  if (isSearch) {
    const indexes = await meilisearchService.getIndexesByType('products')
    const results = await Promise.all(
      indexes.map(async (indexKey) => {
        return meilisearchService.search(indexKey, meili.query ?? '', {
          language: meili.language,
          paginationOptions: { limit, offset },
          semanticSearch: meili.semanticSearch,
          semanticRatio: meili.semanticRatio,
        })
      }),
    )

    const mergedResults = results.reduce<{
      hits: Hit[]
      estimatedTotalHits: number
      processingTimeMs: number
      query: string
    }>(
      (acc, result) => {
        return {
          hits: [...acc.hits, ...result.hits],
          estimatedTotalHits: acc.estimatedTotalHits + result.estimatedTotalHits,
          processingTimeMs: Math.max(acc.processingTimeMs, result.processingTimeMs),
          query: result.query,
        }
      },
      { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query: meili.query ?? '' },
    )

    productIds = mergedResults.hits.map((hit) => {
      return hit.id
    })
    totalCount = mergedResults.estimatedTotalHits

    if (productIds.length === 0) {
      res.json({ products: [], count: 0, limit, offset })

      return
    }

    filters.id = { $in: productIds }
  }

  // Native pricing context (provided by setPricingContext middleware).
  const context: Record<string, unknown> = {}

  if (isPresent(req.pricingContext)) {
    context.variants = { calculated_price: QueryContext({ ...req.pricingContext }) }
  }

  const { data: products = [], metadata } = await query.graph(
    {
      entity: 'product',
      fields: graphFields,
      filters,
      pagination,
      context,
    },
    {
      cache: { enable: true },
      locale: req.locale,
    },
  )

  if (withInventoryQuantity) {
    await wrapVariantsWithInventoryQuantityForSalesChannel(
      req,
      products
        .map((product) => {
          return product.variants
        })
        .flat(1),
    )
  }

  await wrapProductsWithTaxPrices(req, products)

  // Preserve Meilisearch ranking when search drove the result set.
  let orderedProducts = products

  if (isSearch) {
    orderedProducts = [...products].sort((a, b) => {
      return productIds.indexOf(a.id) - productIds.indexOf(b.id)
    })
  }

  res.json({
    products: orderedProducts,
    count: isSearch ? totalCount : (metadata?.count ?? products.length),
    offset: metadata?.skip ?? offset,
    limit: metadata?.take ?? limit,
  })
}
