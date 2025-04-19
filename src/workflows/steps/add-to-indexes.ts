import { createStep, StepResponse } from '@medusajs/framework/dist/workflows-sdk'
import { SearchUtils } from '@medusajs/utils'
import { MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  product: any
  indexes: string[]
}

export const addToIndexesStep = createStep('add-to-indexes', async ({ product, indexes }: StepInput, { container }) => {
  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')
  await Promise.all(
    indexes.map((indexKey) => meilisearchService.addDocuments(indexKey, [product], SearchUtils.indexTypes.PRODUCTS)),
  )
  return new StepResponse()
})
