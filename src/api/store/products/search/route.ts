import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { z } from 'zod'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'

export const SearchSchema = z.object({
  query: z.string(),
})

type SearchRequest = z.infer<typeof SearchSchema>

export async function POST(req: MedusaRequest<SearchRequest>, res: MedusaResponse) {
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  const { query } = req.validatedBody

  const results = await meilisearchService.search(
    'products', // index name
    query,
    {
      paginationOptions: {
        limit: 10,
        offset: 0,
      },
    },
  )

  res.json(results)
}
