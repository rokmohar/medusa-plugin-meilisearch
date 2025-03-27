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

  await meilisearchService.addDocuments('products', [product], SearchUtils.indexTypes.PRODUCTS)
}

export const config: SubscriberConfig = {
  event: 'product.created',
}
