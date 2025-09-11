import z from 'zod'
import { MedusaRequest, MedusaResponse, prepareListQuery } from '@medusajs/framework'
import { QueryContext } from '@medusajs/utils'
import { RemoteQueryFilters, QueryContextType } from '@medusajs/types'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'

// Schema that combines standard MedusaJS product query params with meilisearch params
export const StoreProductsSchema = z.object({
  // Standard MedusaJS v2 product query parameters
  fields: z.string().optional(),
  limit: z.coerce.number().default(50).optional(),
  offset: z.coerce.number().default(0).optional(),
  region_id: z.string().optional(),
  currency_code: z.string().optional(),
  // Meilisearch-specific parameters
  query: z.string().optional(),
  language: z.string().optional(),
  semanticSearch: z.coerce.boolean().default(false).optional(),
  semanticRatio: z.coerce.number().min(0).max(1).default(0.5).optional(),
})

export type StoreProductsParams = z.infer<typeof StoreProductsSchema>

export async function GET(req: MedusaRequest<any, StoreProductsParams>, res: MedusaResponse) {
  const {
    // Meilisearch params
    query,
    language,
    semanticSearch = false,
    semanticRatio = 0.5,
    // Extract standard MedusaJS params separately
    ...standardQuery
  } = req.validatedQuery

  const queryService = req.scope.resolve('query')
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  // Use prepareListQuery to handle field selectors and other standard parameters
  const queryConfig = prepareListQuery(standardQuery, {
    defaults: ['id', 'title', 'handle', 'status'],
    isList: true,
  })

  // Extract query parameters manually for custom filter logic
  const { limit, offset, region_id, currency_code } = standardQuery

  // Build standard Medusa filters
  const filters: RemoteQueryFilters<'product'> = {}

  let productIds: string[] = []
  let totalCount = 0

  // If meilisearch query parameters are provided, use meilisearch for filtering
  if (query || semanticSearch) {
    const indexes = await meilisearchService.getIndexesByType('products')
    const results = await Promise.all(
      indexes.map(async (indexKey) => {
        return await meilisearchService.search(indexKey, query || '', {
          language,
          paginationOptions: {
            limit,
            offset,
          },
          semanticSearch,
          semanticRatio,
        })
      }),
    )

    // Merge results from all indexes
    const mergedResults = results.reduce(
      (acc, result) => {
        return {
          hits: [...acc.hits, ...result.hits],
          estimatedTotalHits: (acc.estimatedTotalHits || 0) + (result.estimatedTotalHits || 0),
          processingTimeMs: Math.max(acc.processingTimeMs, result.processingTimeMs),
          query: result.query,
        }
      },
      { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query: query || '' },
    )

    productIds = mergedResults.hits.map((hit) => hit.id)
    totalCount = mergedResults.estimatedTotalHits ?? 0

    // If we have meilisearch results, filter by those IDs
    if (productIds.length > 0) {
      filters.id = { $in: productIds }
    } else {
      // No results from meilisearch, return empty response
      res.json({
        products: [],
        count: 0,
        limit,
        offset,
      })
      return
    }
  }

  // Build context for region and currency - always include currency_code for price calculations
  const context: QueryContextType = {
    variants: {
      calculated_price: QueryContext({
        region_id,
        currency_code,
      }),
    },
  }

  // Fetch products using the standard Medusa query service with prepareListQuery config
  const { data: products, metadata } = await queryService.graph({
    entity: 'product',
    ...queryConfig.remoteQueryConfig,
    filters,
    context,
  })

  // If we used meilisearch, preserve the order from the search results
  let orderedProducts = products

  if (query || semanticSearch) {
    const productIdOrder = productIds
    orderedProducts = products.sort((a, b) => {
      const aIndex = productIdOrder.indexOf(a.id)
      const bIndex = productIdOrder.indexOf(b.id)
      return aIndex - bIndex
    })
  }

  res.json({
    products: orderedProducts,
    count: query || semanticSearch ? totalCount : metadata?.count || products.length,
    offset,
    limit,
  })
}
