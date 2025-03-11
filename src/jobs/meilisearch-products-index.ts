import { MedusaContainer } from '@medusajs/framework'
import { MeiliSearchService } from '../modules/meilisearch'
import { SearchUtils } from '@medusajs/utils'
import { CronJobConfig } from '../models/CronJobConfig'

export default async function meilisearchProductsIndexJob(container: MedusaContainer) {
  const productService = container.resolve('product')
  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')

  const products = await productService.listProducts()

  const publishedProducts = products.filter((p) => p.status === 'published')
  const deleteDocumentIds = products.filter((p) => p.status !== 'published').map((p) => p.id)

  await meilisearchService.addDocuments('products', publishedProducts, SearchUtils.indexTypes.PRODUCTS)
  await meilisearchService.deleteDocuments('products', deleteDocumentIds)
}

export const config: CronJobConfig = {
  name: 'meilisearch-products-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
