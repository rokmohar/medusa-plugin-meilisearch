import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, Modules, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  priceId: string
}

export const deletePriceStep = createStep('delete-price', async ({ priceId }: StepInput, { container }) => {
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
  const pricingModuleService = container.resolve(Modules.PRICING)
  const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

  let priceSetId: string | null = null

  try {
    const { data: prices } = await queryService.graph({
      entity: 'price',
      fields: ['price_set_id'],
      filters: { id: priceId },
    })

    if (prices.length && prices[0].price_set_id) {
      priceSetId = prices[0].price_set_id
    }
  } catch {
    // Price might be deleted
  }

  if (!priceSetId) {
    try {
      const [price] = await pricingModuleService.listPrices(
        { id: [priceId] },
        { withDeleted: true, select: ['price_set_id'] },
      )
      if (price?.price_set_id) {
        priceSetId = price.price_set_id
      }
    } catch {
      // Price not found
    }
  }

  if (!priceSetId) {
    return new StepResponse({ products: [] })
  }

  const { data: links } = await queryService.graph({
    entity: 'product_variant_price_set',
    fields: ['variant_id'],
    filters: { price_set_id: priceSetId },
  })

  const variantIds = links.map((l) => l.variant_id).filter(Boolean)

  if (!variantIds.length) {
    return new StepResponse({ products: [] })
  }

  const { data: variants } = await queryService.graph({
    entity: 'product_variant',
    fields: ['product_id'],
    filters: { id: variantIds },
  })

  const productIds = [...new Set(variants.map((v) => v.product_id).filter(Boolean))]

  if (!productIds.length) {
    return new StepResponse({ products: [] })
  }

  const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)
  const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  const { data: products } = await queryService.graph({
    entity: 'product',
    fields: productFields,
    filters: { id: productIds },
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
})
