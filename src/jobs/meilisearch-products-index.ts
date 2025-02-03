import { MedusaContainer } from '@medusajs/framework'
import { MeiliSearchService } from '../modules/meilisearch'
import { SearchUtils } from '@medusajs/utils'
import { CronJobConfig } from '../models/CronJobConfig'

export default async function meilisearchProductsIndexJob(container: MedusaContainer) {
  const productService = container.resolve('product')
  const meilisearchService: MeiliSearchService = container.resolve('meilisearch')

  const products = await productService.listProducts()
  await meilisearchService.addDocuments('products', products, SearchUtils.indexTypes.PRODUCTS)
}

export const config: CronJobConfig = {
  name: 'meilisearch-products-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
