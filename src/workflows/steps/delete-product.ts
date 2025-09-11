import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  id: string
}

export const deleteProductStep = createStep('delete-product', async ({ id }: StepInput, { container }) => {
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)
  const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  await Promise.all(productIndexes.map((indexKey) => meilisearchService.deleteDocument(indexKey, id)))

  return new StepResponse()
})
