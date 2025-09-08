import { SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { indexProducts } from '../utils/product-indexer'

export default async function meilisearchSyncHandler({ container }: SubscriberArgs) {
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

export const config: SubscriberConfig = {
  event: 'meilisearch.sync',
}
