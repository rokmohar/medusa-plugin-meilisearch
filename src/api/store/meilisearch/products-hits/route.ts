import z from 'zod'
import { Hit, SearchResponse } from 'meilisearch'
import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'

export const StoreSearchProductsSchema = z.object({
  query: z.string(),
  limit: z.coerce.number().default(10),
  offset: z.coerce.number().default(0),
  language: z.string().optional(),
  semanticSearch: z.coerce.boolean().default(false),
  semanticRatio: z.coerce.number().min(0).max(1).default(0.5),
  // Meilisearch-native faceting/sorting passthrough.
  filter: z.string().optional(),
  sort: z.union([z.string(), z.array(z.string())]).optional(),
})

export type StoreSearchProductsParams = z.infer<typeof StoreSearchProductsSchema>

export type ProductsHitsResponse = SearchResponse & { hybridSearch?: boolean; semanticRatio?: number }

export async function GET(
  req: MedusaRequest<unknown, StoreSearchProductsParams>,
  res: MedusaResponse<ProductsHitsResponse>,
) {
  const { query, language, limit, offset, semanticSearch, semanticRatio, filter, sort } = req.validatedQuery
  const sortArr = Array.isArray(sort) ? sort : sort !== undefined ? [sort] : undefined
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  const indexes = await meilisearchService.getIndexesByType('products')
  const results = await Promise.all(
    indexes.map(async (indexKey) => {
      return await meilisearchService.search(indexKey, query, {
        language,
        paginationOptions: {
          limit,
          offset,
        },
        filter,
        additionalOptions: sortArr ? { sort: sortArr } : undefined,
        semanticSearch,
        semanticRatio,
      })
    }),
  )

  // Merge results from all indexes
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
    { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query },
  )

  res.json({
    ...mergedResults,
    ...(semanticSearch && { hybridSearch: true, semanticRatio }),
  })
}
