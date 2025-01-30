import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Modules, ProductEvents, SearchUtils } from '@medusajs/utils'
import { MeiliSearchService } from '../modules/meilisearch'

export default async function meilisearchProductUpsertHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const productModuleService = container.resolve(Modules.PRODUCT)
  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')

  const product = await productModuleService.retrieveProduct(productId)
  await meilisearchService.addDocuments('products', [product], SearchUtils.indexTypes.PRODUCTS)
}

export const config: SubscriberConfig = {
  event: [ProductEvents.PRODUCT_CREATED, ProductEvents.PRODUCT_UPDATED],
}
