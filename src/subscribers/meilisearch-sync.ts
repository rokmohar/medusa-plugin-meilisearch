import { SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { syncProductsWorkflow } from '../workflows/sync-products'

export default async function meilisearchSyncHandler({ container }: SubscriberArgs) {
  const logger = container.resolve('logger')

  logger.info('Starting product indexing...')

  const {
    result: { products },
  } = await syncProductsWorkflow(container).run({
    input: {},
  })

  logger.info(`Successfully indexed ${products.length} products`)
}

export const config: SubscriberConfig = {
  event: 'meilisearch.sync',
}
