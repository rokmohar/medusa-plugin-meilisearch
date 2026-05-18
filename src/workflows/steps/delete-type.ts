import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  typeId: string
}

export const deleteTypeStep = createStep('delete-type', async ({ typeId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  let productIds: string[] = []

  try {
    const { data: types } = await queryService.graph({
      entity: 'product_type',
      fields: ['products.id'],
      filters: { id: typeId },
    })

    productIds = types.flatMap((type) => type.products?.map((p: { id: string }) => p.id) || []).filter(Boolean)
  } catch {
    // Type might be deleted
  }

  if (!productIds.length) {
    try {
      const { data: products } = await queryService.graph({
        entity: 'product',
        fields: ['id'],
        filters: { type_id: typeId },
      })
      productIds = products.map((p) => p.id).filter(Boolean)
    } catch {
      // Products not found
    }
  }

  if (!productIds.length) {
    return new StepResponse({ products: [] })
  }

  const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)
  const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  const { data: products } = await queryService.graph({
    entity: 'product',
    fields: productFields,
    filters: { id: [...new Set(productIds)] },
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

  return new StepResponse({ products })
})
