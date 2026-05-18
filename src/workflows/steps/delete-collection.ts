import { createStep, StepResponse } from '@medusajs/workflows-sdk'
import { ContainerRegistrationKeys, SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../modules/meilisearch'

type StepInput = {
  collectionId: string
}

export const deleteCollectionStep = createStep(
  'delete-collection',
  async ({ collectionId }: StepInput, { container }) => {
    const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
    const meilisearchService: MeiliSearchService = container.resolve(MEILISEARCH_MODULE)

    let productIds: string[] = []

    try {
      const { data: collections } = await queryService.graph({
        entity: 'product_collection',
        fields: ['products.id'],
        filters: { id: collectionId },
      })

      productIds = collections
        .flatMap((col) => {
          return (
            col.products?.map((p: { id: string }) => {
              return p.id
            }) ?? []
          )
        })
        .filter(Boolean)
    } catch {
      // Collection might be deleted
    }

    if (!productIds.length) {
      try {
        const { data: products } = await queryService.graph({
          entity: 'product',
          fields: ['id'],
          filters: { collection_id: collectionId },
        })

        productIds = products
          .map((p) => {
            return p.id
          })
          .filter(Boolean)
      } catch {
        // Products not found
      }
    }

    if (!productIds.length) {
      return new StepResponse({ products: [] })
    }

    const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)
    const productIndexes = await meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

    const { data: products } = await queryService.graph({
      entity: 'product',
      fields: productFields,
      filters: { id: [...new Set(productIds)] },
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
