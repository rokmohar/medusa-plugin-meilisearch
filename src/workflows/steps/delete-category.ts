import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  categoryId: string
}

export const deleteCategoryStep = createStep('delete-category', async ({ categoryId }: StepInput, { container }) => {
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)
  const categoryIndexes = await meilisearchService.getIndexesByType('categories')

  await Promise.all(
    categoryIndexes.map(async (indexKey) => {
      return meilisearchService.deleteDocument(indexKey, categoryId)
    }),
  )

  return new StepResponse({
    categoryId,
  })
})
