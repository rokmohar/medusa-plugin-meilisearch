import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Modules, SearchUtils } from '@medusajs/utils'
import { MeiliSearchService } from '../modules/meilisearch'

export default async function meilisearchProductCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const productModuleService = container.resolve(Modules.PRODUCT)
  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')

  const product = await productModuleService.retrieveProduct(productId, {
    relations: ['*'],
  })

  // Get all enabled indexes with type "products"
  const productIndexes = meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  // Add document to all product indexes
  await Promise.all(
    productIndexes.map((indexKey) =>
      meilisearchService.addDocuments(indexKey, [product], SearchUtils.indexTypes.PRODUCTS),
    ),
  )
}

export const config: SubscriberConfig = {
  event: 'product.created',
}
