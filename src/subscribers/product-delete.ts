import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { MeiliSearchService } from '../modules/meilisearch'

export default async function productDeleteHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const meiliSearchService: MeiliSearchService = container.resolve('meilisearch')
  await meiliSearchService.deleteDocument('products', productId)
}

export const config: SubscriberConfig = {
  event: ProductEvents.PRODUCT_DELETED,
}
