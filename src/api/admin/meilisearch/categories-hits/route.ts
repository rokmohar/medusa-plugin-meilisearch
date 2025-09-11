import { z } from 'zod'
import { SearchResponse } from 'meilisearch'
import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'

export const AdminSearchCategoriesSchema = z.object({
  query: z.string(),
  limit: z.coerce.number().default(10),
  offset: z.coerce.number().default(0),
  language: z.string().optional(),
  semanticSearch: z.coerce.boolean().default(false),
  semanticRatio: z.coerce.number().min(0).max(1).default(0.5),
})

export type AdminSearchCategoriesParams = z.infer<typeof AdminSearchCategoriesSchema>

export async function POST(req: MedusaRequest<any, AdminSearchCategoriesParams>, res: MedusaResponse<SearchResponse>) {
  const { query, language, limit, offset, semanticSearch, semanticRatio } = req.validatedBody
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  const indexes = await meilisearchService.getIndexesByType('categories')
  const results = await Promise.all(
    indexes.map(async (indexKey) => {
      return await meilisearchService.search(indexKey, query, {
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
        // Include vector search metadata if available
        ...(semanticSearch && {
          hybridSearch: true,
          semanticRatio,
        }),
      }
    },
    { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query },
  )

  res.json(mergedResults)
}
