import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

export type StepInput = {
  filters?: Record<string, any>
  limit?: number
  offset?: number
}

export const syncCategoriesStep = createStep(
  'sync-categories',
  async ({ filters, limit, offset }: StepInput, { container }) => {
    const queryService = container.resolve('query')
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

    const categoryFields = await meilisearchService.getFieldsForType('categories')
    const categoryIndexes = await meilisearchService.getIndexesByType('categories')

    const { data: categories } = await queryService.graph({
      entity: 'product_category',
      fields: categoryFields,
      pagination: {
        take: limit,
        skip: offset,
      },
      filters: {
        is_active: true,
        ...filters,
      },
    })

    const existingCategoryIds = new Set(
      (
        await Promise.all(
          categoryIndexes.map((index) =>
            meilisearchService.search(index, '', {
              filter: `id IN [${categories.map((c) => c.id).join(',')}]`,
              attributesToRetrieve: ['id'],
            }),
          ),
        )
      )
        .flatMap((result) => result.hits)
        .map((hit) => hit.id),
    )

    const categoriesToDelete = Array.from(existingCategoryIds).filter((id) => !categories.some((c) => c.id === id))

    await Promise.all(categoryIndexes.map((index) => meilisearchService.addDocuments(index, categories)))
    await Promise.all(categoryIndexes.map((index) => meilisearchService.deleteDocuments(index, categoriesToDelete)))

    return new StepResponse({
      categories,
    })
  },
)
