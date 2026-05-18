import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, Modules, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  optionValueId: string
}

export const deleteOptionValueStep = createStep('delete-value', async ({ optionValueId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  let productId: string | null = null

  try {
    const { data: optionValues } = await queryService.graph({
      entity: 'product_option_value',
      fields: ['option.product_id'],
      filters: { id: optionValueId },
    })

    if (optionValues.length && optionValues[0].option?.product_id) {
      productId = optionValues[0].option.product_id
    }
  } catch {
    // Option value might be deleted
  }

  if (!productId) {
    try {
      const [optionValue] = await productModuleService.listProductOptionValues(
        { id: optionValueId },
        { withDeleted: true, select: ['option_id'] },
      )

      if (optionValue.option_id) {
        const [option] = await productModuleService.listProductOptions(
          { id: optionValue.option_id },
          { withDeleted: true, select: ['product_id'] },
        )

        if (option.product_id) {
          productId = option.product_id
        }
      }
    } catch {
      // Option value not found
    }
  }

  if (!productId) {
    return new StepResponse({ products: [] })
  }

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
