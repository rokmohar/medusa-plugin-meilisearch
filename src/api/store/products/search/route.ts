import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { z } from 'zod'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'
import { SearchResponse } from 'meilisearch'

export const SearchSchema = z.object({
  query: z.string(),
  language: z.string().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  const { query, language } = await SearchSchema.parseAsync(req.query)

  const indexes = await meilisearchService.getIndexesByType('product')
  const results = await Promise.all(
    indexes.map(async (indexKey) => {
      return await meilisearchService.search(indexKey, query, {
        language,
        paginationOptions: {
          limit: 10,
          offset: 0,
        },
      })
    }),
  )

  // Merge results from all indexes
  const mergedResults = results.reduce<SearchResponse<Record<string, unknown>>>(
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
