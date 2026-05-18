import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  typeId: string
}

export const upsertTypeStep = createStep('upsert-type', async ({ typeId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  const { data: products } = await queryService.graph({
    entity: 'product',
    fields: await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS),
    filters: { type_id: typeId },
  })

  if (!products.length) {
    return new StepResponse({ products: [] })
  }

  const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

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
