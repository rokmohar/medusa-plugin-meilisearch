import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { MeiliSearchService } from '../modules/meilisearch'

export default async function meilisearchProductDeleteHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')
  await meilisearchService.deleteDocument('products', productId)
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
