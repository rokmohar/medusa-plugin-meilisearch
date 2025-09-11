import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ProductCategoryDTO, RemoteQueryFilters } from '@medusajs/types'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

export type StepInput = {
  filters?: RemoteQueryFilters<'product_category'>
  batchSize?: number
}

export const syncCategoriesStep = createStep(
  'sync-categories',
  async ({ filters, batchSize = 1000 }: StepInput, { container }) => {
    const queryService = container.resolve('query')
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

    const categoryFields = await meilisearchService.getFieldsForType('categories')
    const categoryIndexes = await meilisearchService.getIndexesByType('categories')

    const allCategoryIds: ProductCategoryDTO[] = []

    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: categories } = await queryService.graph({
        entity: 'product_category',
        fields: categoryFields,
        pagination: {
          take: batchSize,
          skip: offset,
        },
        filters: {
          is_active: true,
          ...filters,
        },
      })

      if (categories.length === 0) {
        hasMore = false
        break
      }

      await Promise.all(categoryIndexes.map((index) => meilisearchService.addDocuments(index, categories)))

      allCategoryIds.push(...categories.map((c) => c.id))
      offset += batchSize

      if (categories.length < batchSize) {
        hasMore = false
      }
    }

    const validCategoryIds = new Set(allCategoryIds)
    const categoriesToDelete = new Set<string>()

    for (const index of categoryIndexes) {
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
          if (!validCategoryIds.has(hit.id)) {
            categoriesToDelete.add(hit.id)
          }
        })

        indexOffset += batchSize

        if (indexedResult.hits.length < batchSize) {
          hasMoreIndexed = false
        }
      }
    }

    if (categoriesToDelete.size > 0) {
      const orphanedIds = Array.from(categoriesToDelete)

      for (let i = 0; i < orphanedIds.length; i += batchSize) {
        const batch = orphanedIds.slice(i, i + batchSize)
        await Promise.all(categoryIndexes.map((index) => meilisearchService.deleteDocuments(index, batch)))
      }
    }

    return new StepResponse({
      totalProcessed: allCategoryIds.length,
      totalDeleted: categoriesToDelete.size,
    })
  },
)
