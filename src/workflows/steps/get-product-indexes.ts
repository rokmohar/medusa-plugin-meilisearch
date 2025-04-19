import { createStep, StepResponse } from '@medusajs/framework/dist/workflows-sdk'
import { SearchUtils } from '@medusajs/utils'
import { MeiliSearchService } from '../../modules/meilisearch'

export const getProductIndexesStep = createStep('get-product-indexes', async (_, { container }) => {
  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')
  const productIndexes = meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)
  return new StepResponse(productIndexes)
})
