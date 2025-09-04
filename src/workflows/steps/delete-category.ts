import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  id: string
}

export const deleteCategoryStep = createStep('delete-category', async ({ id }: StepInput, { container }) => {
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)
  const categoryIndexes = await meilisearchService.getIndexesByType('categories')

  await Promise.all(categoryIndexes.map((indexKey) => meilisearchService.deleteDocument(indexKey, id)))

  return new StepResponse({
    id,
  })
})
