import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  optionId: string
}

export const upsertOptionStep = createStep('upsert-option', async ({ optionId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  const { data: options } = await queryService.graph({
    entity: 'product_option',
    fields: ['product_id'],
    filters: { id: optionId },
  })

  if (!options.length || !options[0].product_id) {
    return new StepResponse({ products: [] })
  }

  const productId = options[0].product_id

  const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)
  const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  const { data: products } = await queryService.graph({
    entity: 'product',
    fields: productFields,
    filters: { id: productId },
  })

  await Promise.all(
    products.map(async (product) => {
      if (!product.status || product.status === 'published') {
        await Promise.all(
          productIndexes.map(async (indexKey) => {
            return meilisearchService.addDocuments(indexKey, [product], SearchUtils.indexTypes.PRODUCTS, { container })
          }),
        )
      } else {
        await Promise.all(
          productIndexes.map(async (indexKey) => {
            return meilisearchService.deleteDocument(indexKey, product.id)
          }),
        )
      }
    }),
  )

  return new StepResponse({ products })
})
