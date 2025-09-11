import { SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { syncCategoriesWorkflow } from '../workflows/sync-categories'
import { syncProductsWorkflow } from '../workflows/sync-products'

export default async function meilisearchSyncHandler({ container }: SubscriberArgs) {
  const logger = container.resolve('logger')

  logger.info('Starting MeiliSearch indexing...')

  const {
    result: { totalProcessed: categoriesProcessed, totalDeleted: categoriesDeleted },
  } = await syncCategoriesWorkflow(container).run({
    input: {},
  })

  logger.info(`Successfully indexed ${categoriesProcessed} categories and deleted ${categoriesDeleted} categories`)

  const {
    result: { totalProcessed: productsProcessed, totalDeleted: productsDeleted },
  } = await syncProductsWorkflow(container).run({
    input: {},
  })

  logger.info(`Successfully indexed ${productsProcessed} products and deleted ${productsDeleted} products`)
}

export const config: SubscriberConfig = {
  event: 'meilisearch.sync',
}
