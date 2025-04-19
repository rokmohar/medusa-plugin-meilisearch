import { ProductDTO } from '@medusajs/types'
import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'
import { SearchUtils } from '@medusajs/utils'

export type SyncProductsStepInput = {
  products: ProductDTO[]
}

export const syncProductsStep = createStep(
  'sync-products',
  async ({ products }: SyncProductsStepInput, { container }) => {
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)
    const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

    const existingProducts = (
      await Promise.all(
        productIndexes.map((index) =>
          meilisearchService.search(index, '', { filter: `id IN [${products.map((p) => p.id).join(',')}]` }),
        ),
      )
    )
      .flatMap((result) => result.hits)
      .filter(Boolean)

    const newProducts = products.filter((product) => !existingProducts.some((p) => p.id === product.id))

    await Promise.all(
      productIndexes.map((index) => meilisearchService.addDocuments(index, products, SearchUtils.indexTypes.PRODUCTS)),
    )

    return new StepResponse(undefined, {
      newProducts: newProducts.map((product) => product.id),
      existingProducts,
    })
  },
  async (input, { container }) => {
    if (!input) {
      return
    }

    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)
    const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

    if (input.newProducts) {
      await Promise.all(productIndexes.map((index) => meilisearchService.deleteDocuments(index, input.newProducts)))
    }

    if (input.existingProducts) {
      await Promise.all(
        productIndexes.map((index) =>
          meilisearchService.addDocuments(index, input.existingProducts, SearchUtils.indexTypes.PRODUCTS),
        ),
      )
    }
  },
)
