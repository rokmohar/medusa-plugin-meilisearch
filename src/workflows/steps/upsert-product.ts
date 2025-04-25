import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  id: string
}

export const upsertProductStep = createStep('upsert-products', async ({ id }: StepInput, { container }) => {
  const queryService = container.resolve('query')
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)
  const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  const { data: products } = await queryService.graph({
    entity: 'product',
    fields: productFields,
    filters: { id },
  })

  await Promise.all(
    products.map(async (product) => {
      if (!product.status || product.status === 'published') {
        await Promise.all(productIndexes.map((indexKey) => meilisearchService.addDocuments(indexKey, [product])))
      } else {
        await Promise.all(productIndexes.map((indexKey) => meilisearchService.deleteDocument(indexKey, product.id)))
      }
    }),
  )

  return new StepResponse({
    products,
  })
})
