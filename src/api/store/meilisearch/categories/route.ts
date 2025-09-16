import z from 'zod'
import { MedusaRequest, MedusaResponse, prepareListQuery } from '@medusajs/framework'
import { ProductCategoryDTO, RemoteQueryFilters } from '@medusajs/types'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'

// Schema that combines standard MedusaJS category query params with meilisearch params
export const StoreCategoriesSchema = z.object({
  // Standard MedusaJS v2 category query parameters
  fields: z.string().optional(),
  limit: z.coerce.number().default(50).optional(),
  offset: z.coerce.number().default(0).optional(),
  // Meilisearch-specific parameters
  query: z.string().optional(),
  language: z.string().optional(),
  semanticSearch: z.coerce.boolean().default(false).optional(),
  semanticRatio: z.coerce.number().min(0).max(1).default(0.5).optional(),
})

export type StoreCategoriesParams = z.infer<typeof StoreCategoriesSchema>

export interface CategoriesResponse {
  categories: ProductCategoryDTO[]
  count: number
  limit?: number
  offset?: number
}

export async function GET(req: MedusaRequest<any, StoreCategoriesParams>, res: MedusaResponse<CategoriesResponse>) {
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
    defaults: ['id', 'name', 'handle'],
    isList: true,
  })

  // Extract query parameters manually for custom filter logic
  const { limit, offset } = standardQuery

  // Build standard Medusa filters
  const filters: RemoteQueryFilters<'product_category'> = {}

  let categoryIds: string[] = []
  let totalCount = 0

  // If meilisearch query parameters are provided, use meilisearch for filtering
  if (query || semanticSearch) {
    const indexes = await meilisearchService.getIndexesByType('categories')
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

    categoryIds = mergedResults.hits.map((hit) => hit.id)
    totalCount = mergedResults.estimatedTotalHits ?? 0

    // If we have meilisearch results, filter by those IDs
    if (categoryIds.length > 0) {
      filters.id = { $in: categoryIds }
    } else {
      // No results from meilisearch, return empty response
      res.json({
        categories: [],
        count: 0,
        limit,
        offset,
      })
      return
    }
  }

  // Fetch categories using the standard Medusa query service with prepareListQuery config
  const { data: categories, metadata } = await queryService.graph({
    entity: 'product_category',
    ...queryConfig.remoteQueryConfig,
    filters,
  })

  // If we used meilisearch, preserve the order from the search results
  let orderedCategories = categories

  if (query || semanticSearch) {
    const categoryIdOrder = categoryIds
    orderedCategories = categories.sort((a, b) => {
      const aIndex = categoryIdOrder.indexOf(a.id)
      const bIndex = categoryIdOrder.indexOf(b.id)
      return aIndex - bIndex
    })
  }

  res.json({
    categories: orderedCategories,
    count: query || semanticSearch ? totalCount : metadata?.count || categories.length,
    offset,
    limit,
  })
}
