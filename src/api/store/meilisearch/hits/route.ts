import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'
import { SearchResponse } from 'meilisearch'
import z from 'zod'

export const StoreSearchProductsSchema = z.object({
  query: z.string(),
  limit: z.coerce.number().default(10),
  offset: z.coerce.number().default(0),
  language: z.string().optional(),
})

export type StoreSearchProductsParams = z.infer<typeof StoreSearchProductsSchema>

export async function GET(req: MedusaRequest<any, StoreSearchProductsParams>, res: MedusaResponse<SearchResponse>) {
  const { query, language, limit, offset } = req.validatedQuery
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
    { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query },
  )

  res.json(mergedResults)
}
