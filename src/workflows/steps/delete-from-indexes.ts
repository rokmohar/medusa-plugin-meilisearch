import { createStep, StepResponse } from '@medusajs/framework/dist/workflows-sdk'
import { MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  id: string
  indexes: string[]
}

export const deleteFromIndexesStep = createStep(
  'delete-from-indexes',
  async ({ id, indexes }: StepInput, { container }) => {
    const meilisearchService: MeiliSearchService = container.resolve('meilisearch')
    await Promise.all(indexes.map((indexKey) => meilisearchService.deleteDocument(indexKey, id)))
    return new StepResponse()
  },
)
