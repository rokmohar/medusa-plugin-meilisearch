import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Modules, SearchUtils } from '@medusajs/utils'
import { MeiliSearchService } from '../modules/meilisearch'

export default async function meilisearchProductUpsertHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const productModuleService = container.resolve(Modules.PRODUCT)
  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')


  const product = await productModuleService.retrieveProduct(productId,
    {
      relations: ["*"],
    }
  )



  if (product.status === 'published') {
    // If status is "published", add or update the document in MeiliSearch
    await meilisearchService.addDocuments('products', [product], SearchUtils.indexTypes.PRODUCTS)
  } else {
    // If status is not "published", remove the document from MeiliSearch
    await meilisearchService.deleteDocument('products', productId)
  }
}

export const config: SubscriberConfig = {
  event: "product.updated",
}