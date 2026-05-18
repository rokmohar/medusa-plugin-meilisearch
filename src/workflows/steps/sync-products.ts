import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { ProductDTO, RemoteQueryFilters } from '@medusajs/types'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

export type StepInput = {
  filters?: RemoteQueryFilters<'product'>
  batchSize?: number
}

export const syncProductsStep = createStep(
  'sync-products',
  async ({ filters, batchSize = 1000 }: StepInput, { container }) => {
    const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

    const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)
    const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

    const allProductIds: ProductDTO[] = []

    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: products } = await queryService.graph({
        entity: 'product',
        fields: productFields,
        pagination: {
          take: batchSize,
          skip: offset,
        },
        filters: {
          status: 'published',
          ...filters,
        },
      })

      if (products.length === 0) {
        hasMore = false
        break
      }

      await Promise.all(
        productIndexes.map(async (index) => {
          return meilisearchService.addDocuments(index, products, SearchUtils.indexTypes.PRODUCTS, { container })
        }),
      )

      allProductIds.push(
        ...products.map((p) => {
          return p.id
        }),
      )
      offset += batchSize

      if (products.length < batchSize) {
        hasMore = false
      }
    }

    const validProductIds = new Set(allProductIds)
    const productsToDelete = new Set<string>()

    for (const index of productIndexes) {
      let indexOffset = 0
      let hasMoreIndexed = true

      while (hasMoreIndexed) {
        const indexedResult = await meilisearchService.search(index, '', {
          attributesToRetrieve: ['id'],
          paginationOptions: {
            offset: indexOffset,
            limit: batchSize,
          },
        })

        if (indexedResult.hits.length === 0) {
          hasMoreIndexed = false
          break
        }

        indexedResult.hits.forEach((hit) => {
          if (!validProductIds.has(hit.id)) {
            productsToDelete.add(hit.id)
          }
        })

        indexOffset += batchSize

        if (indexedResult.hits.length < batchSize) {
          hasMoreIndexed = false
        }
      }
    }

    if (productsToDelete.size > 0) {
      const orphanedIds = Array.from(productsToDelete)

      for (let i = 0; i < orphanedIds.length; i += batchSize) {
        const batch = orphanedIds.slice(i, i + batchSize)

        await Promise.all(
          productIndexes.map(async (index) => {
            return meilisearchService.deleteDocuments(index, batch)
          }),
        )
      }
    }

    return new StepResponse({
      totalProcessed: allProductIds.length,
      totalDeleted: productsToDelete.size,
    })
  },
)
