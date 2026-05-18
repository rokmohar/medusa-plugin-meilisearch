import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  categoryId: string
}

export const upsertCategoryStep = createStep('upsert-category', async ({ categoryId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  const categoryFields = await meilisearchService.getFieldsForType('categories')
  const categoryIndexes = await meilisearchService.getIndexesByType('categories')

  const { data: categories } = await queryService.graph({
    entity: 'product_category',
    fields: categoryFields,
    filters: { id: categoryId },
  })

  await Promise.all(
    categories.map(async (category) => {
      if (category.is_active) {
        await Promise.all(
          categoryIndexes.map((indexKey) =>
            meilisearchService.addDocuments(indexKey, [category], 'categories', { container }),
          ),
        )
      } else {
        await Promise.all(categoryIndexes.map((indexKey) => meilisearchService.deleteDocument(indexKey, category.id)))
      }
    }),
  )

  return new StepResponse({
    categories,
  })
})
