import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  tagId: string
}

export const upsertTagStep = createStep('upsert-tag', async ({ tagId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  const { data: tags } = await queryService.graph({
    entity: 'product_tag',
    fields: ['products.id'],
    filters: { id: tagId },
  })

  const productIds = tags
    .flatMap((tag) => {
      return (
        tag.products?.map((p: { id: string }) => {
          return p.id
        }) ?? []
      )
    })
    .filter(Boolean)

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
