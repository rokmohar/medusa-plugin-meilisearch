import { MedusaContainer } from '@medusajs/framework'
import { syncProductsWorkflow } from '../workflows/sync-products'
import { CronJobConfig } from '../models/CronJobConfig'

export default async function meilisearchProductsIndexJob(container: MedusaContainer) {
  const logger = container.resolve('logger')
  logger.info('Starting product indexing...')

  const {
    result: { products },
  } = await syncProductsWorkflow(container).run({
    input: {},
  })

  logger.info(`Successfully indexed ${products.length} products`)
}

export const config: CronJobConfig = {
  name: 'meilisearch-products-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
