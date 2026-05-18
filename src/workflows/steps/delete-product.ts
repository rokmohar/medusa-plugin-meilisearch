import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  productId: string
}

export const deleteProductStep = createStep('delete-product', async ({ productId }: StepInput, { container }) => {
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)
  const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  await Promise.all(
    productIndexes.map(async (indexKey) => {
      return meilisearchService.deleteDocument(indexKey, productId)
    }),
  )

  return new StepResponse({
    productId,
  })
})
