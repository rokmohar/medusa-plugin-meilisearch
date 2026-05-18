import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  tagId: string
}

export const deleteTagStep = createStep('delete-tag', async ({ tagId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  let productIds: string[] = []

  try {
    const { data: tags } = await queryService.graph({
      entity: 'product_tag',
      fields: ['products.id'],
      filters: { id: tagId },
    })

    productIds = tags.flatMap((tag) => tag.products?.map((p: { id: string }) => p.id) || []).filter(Boolean)
  } catch {
    // Tag might be deleted
  }

  if (!productIds.length) {
    try {
      const { data: products } = await queryService.graph({
        entity: 'product',
        fields: ['id'],
        filters: { tags: { id: [tagId] } },
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
