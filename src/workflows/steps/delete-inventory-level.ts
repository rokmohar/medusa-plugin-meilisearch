import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, Modules, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  inventoryLevelId: string
}

export const deleteInventoryLevelStep = createStep(
  'delete-inventory-level',
  async ({ inventoryLevelId }: StepInput, { container }) => {
    const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
    const inventoryModuleService = container.resolve(Modules.INVENTORY)
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

    let inventoryItemId: string | null = null

    try {
      const { data: levels } = await queryService.graph({
        entity: 'inventory_level',
        fields: ['inventory_item_id'],
        filters: { id: inventoryLevelId },
      })

      if (levels.length && levels[0].inventory_item_id) {
        inventoryItemId = levels[0].inventory_item_id
      }
    } catch {
      // Level might be deleted
    }

    if (!inventoryItemId) {
      try {
        const [level] = await inventoryModuleService.listInventoryLevels(
          { id: inventoryLevelId },
          { withDeleted: true, select: ['inventory_item_id'] },
        )

        if (level.inventory_item_id) {
          inventoryItemId = level.inventory_item_id
        }
      } catch {
        // Level not found
      }
    }

    if (!inventoryItemId) {
      return new StepResponse({ products: [] })
    }

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
