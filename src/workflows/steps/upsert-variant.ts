import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  variantId: string
}

export const upsertVariantStep = createStep('upsert-variant', async ({ variantId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  const { data: variants } = await queryService.graph({
    entity: 'product_variant',
    fields: ['product_id'],
    filters: { id: variantId },
  })

  if (!variants.length || !variants[0].product_id) {
    return new StepResponse({ products: [] })
  }

  const productId = variants[0].product_id

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
          productIndexes.map((indexKey) =>
            meilisearchService.addDocuments(indexKey, [product], SearchUtils.indexTypes.PRODUCTS, { container }),
          ),
        )
      } else {
        await Promise.all(productIndexes.map((indexKey) => meilisearchService.deleteDocument(indexKey, product.id)))
      }
    }),
  )

  return new StepResponse({
    products,
  })
})
