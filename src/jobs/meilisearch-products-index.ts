import { MedusaContainer } from '@medusajs/framework'
import { CronJobConfig } from '../models/CronJobConfig'
import { syncProductsWorkflow } from '../workflows/sync-products'

export default async function meilisearchProductsIndexJob(container: MedusaContainer) {
  const logger = container.resolve('logger')
  logger.info('Starting product indexing...')

  const {
    result: { totalProcessed, totalDeleted },
  } = await syncProductsWorkflow(container).run({
    input: {},
  })

  logger.info(`Successfully indexed ${totalProcessed} products and deleted ${totalDeleted} products`)
}

export const config: CronJobConfig = {
  name: 'meilisearch-products-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
