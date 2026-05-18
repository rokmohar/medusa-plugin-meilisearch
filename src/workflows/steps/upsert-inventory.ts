import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  inventoryItemId: string
}

export const upsertInventoryStep = createStep(
  'upsert-inventory',
  async ({ inventoryItemId }: StepInput, { container }) => {
    const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

    const { data: links } = await queryService.graph({
      entity: 'product_variant_inventory_item',
      fields: ['variant_id'],
      filters: { inventory_item_id: inventoryItemId },
    })

    const variantIds = links
      .map((l) => {
        return l.variant_id
      })
      .filter(Boolean)

    if (!variantIds.length) {
      return new StepResponse({ products: [] })
    }

    const { data: variants } = await queryService.graph({
      entity: 'product_variant',
      fields: ['product_id'],
      filters: { id: variantIds },
    })

    const productIds = [
      ...new Set(
        variants
          .map((v) => {
            return v.product_id
          })
          .filter(Boolean),
      ),
    ]

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
            productIndexes.map(async (indexKey) => {
              return meilisearchService.addDocuments(indexKey, [product], SearchUtils.indexTypes.PRODUCTS, {
                container,
              })
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
  },
)
