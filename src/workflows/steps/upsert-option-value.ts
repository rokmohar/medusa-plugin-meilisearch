import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  optionValueId: string
}

export const upsertOptionValueStep = createStep(
  'upsert-option-value',
  async ({ optionValueId }: StepInput, { container }) => {
    const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

    const { data: optionValues } = await queryService.graph({
      entity: 'product_option_value',
      fields: ['option_id'],
      filters: { id: optionValueId },
    })

    if (!optionValues.length || !optionValues[0].option_id) {
      return new StepResponse({ products: [] })
    }

    const { data: options } = await queryService.graph({
      entity: 'product_option',
      fields: ['product_id'],
      filters: { id: optionValues[0].option_id },
    })

    if (!options.length || !options[0].product_id) {
      return new StepResponse({ products: [] })
    }

    const productId = options[0].product_id

    const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)
    const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

    const { data: products } = await queryService.graph({
      entity: 'product',
      fields: productFields,
      filters: { id: productId },
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
  },
)
