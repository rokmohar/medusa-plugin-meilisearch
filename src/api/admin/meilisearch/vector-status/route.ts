import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'

interface VectorSearchStatus {
  enabled: boolean
  provider?: string
  model?: string
  dimensions?: number
  embeddingFields: string[]
  semanticRatio: number
}

export async function GET(req: MedusaRequest, res: MedusaResponse<VectorSearchStatus>) {
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)
  
  // Use the new method to get vector search status
  const status = await meilisearchService.getVectorSearchStatus()
  
  res.json(status)
}
