import { ProductStatus, SearchUtils } from '@medusajs/utils'
import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

export type StepInput = {
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export const syncProductsStep = createStep(
  'sync-products',
  async ({ filters, limit, offset }: StepInput, { container }) => {
    const queryService = container.resolve('query')
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

    const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)
    const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

    const { data: products } = await queryService.graph({
      entity: 'product',
      fields: productFields,
      pagination: {
        take: limit,
        skip: offset,
      },
      filters: {
        status: ProductStatus.PUBLISHED,
        ...filters,
      },
    })

    const existingProductIds = new Set(
      (
        await Promise.all(
          productIndexes.map((index) =>
            meilisearchService.search(index, '', {
              filter: `id IN [${products.map((p) => p.id).join(',')}]`,
              attributesToRetrieve: ['id'],
            }),
          ),
        )
      )
        .flatMap((result) => result.hits)
        .map((hit) => hit.id),
    )

    const productsToDelete = Array.from(existingProductIds).filter((id) => !products.some((p) => p.id === id))

    await Promise.all(productIndexes.map((index) => meilisearchService.addDocuments(index, products)))
    await Promise.all(productIndexes.map((index) => meilisearchService.deleteDocuments(index, productsToDelete)))

    return new StepResponse({
      products,
    })
  },
)
