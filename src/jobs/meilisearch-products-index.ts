import { MedusaContainer } from '@medusajs/framework'
import { CronJobConfig } from '../models/CronJobConfig'
import { indexProducts } from '../utils/product-indexer'

export default async function meilisearchProductsIndexJob(container: MedusaContainer) {
  const logger = container.resolve('logger')

  try {
    const result = await indexProducts(container, { continueOnError: true })

    if (result.errors.length > 0) {
      logger.warn(`Product indexing completed with ${result.errors.length} errors`)
    }
  } catch (error) {
    logger.error(`Product indexing failed: ${error.message}`)
    throw error
  }
}

export const config: CronJobConfig = {
  name: 'meilisearch-products-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
