import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'
import { ProductDTO } from '@medusajs/types'

type StepInput = {
  products: ProductDTO[]
}

export const upsertProductsStep = createStep('upsert-products', async ({ products }: StepInput, { container }) => {
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)
  const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  await Promise.all(
    products.map(async (product) => {
      if (product.status === 'published') {
        await Promise.all(
          productIndexes.map((indexKey) =>
            meilisearchService.addDocuments(indexKey, [product], SearchUtils.indexTypes.PRODUCTS),
          ),
        )
      } else {
        await Promise.all(productIndexes.map((indexKey) => meilisearchService.deleteDocument(indexKey, product.id)))
      }
    }),
  )

  return new StepResponse()
})
