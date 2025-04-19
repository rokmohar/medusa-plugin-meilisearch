import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { SearchUtils } from '@medusajs/utils'
import { MeiliSearchService } from '../modules/meilisearch'

export default async function meilisearchProductDeletedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')

  // Get all enabled indexes with type "products"
  const productIndexes = meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  // Delete document from all product indexes
  await Promise.all(productIndexes.map((indexKey) => meilisearchService.deleteDocument(indexKey, productId)))
}

export const config: SubscriberConfig = {
  event: 'product.deleted',
}
