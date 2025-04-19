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

  // Get all enabled indexes with type "products"
  const productIndexes = meilisearchService.getIndexesByType(SearchUtils.indexTypes.PRODUCTS)

  // Add documents to all enabled product indexes
  await Promise.all(
    productIndexes.map((indexKey) =>
      meilisearchService.addDocuments(indexKey, publishedProducts, SearchUtils.indexTypes.PRODUCTS),
    ),
  )

  // Delete documents from all enabled product indexes
  await Promise.all(productIndexes.map((indexKey) => meilisearchService.deleteDocuments(indexKey, deleteDocumentIds)))
}

export const config: CronJobConfig = {
  name: 'meilisearch-products-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
