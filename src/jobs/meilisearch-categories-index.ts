import { MedusaContainer } from '@medusajs/framework'
import { CronJobConfig } from '../models/CronJobConfig'
import { syncCategoriesWorkflow } from '../workflows/sync-categories'

export default async function meilisearchCategoriesIndexJob(container: MedusaContainer) {
  const logger = container.resolve('logger')
  logger.info('Starting category indexing...')

  const {
    result: { totalProcessed, totalDeleted },
  } = await syncCategoriesWorkflow(container).run({
    input: {},
  })

  logger.info(`Successfully indexed ${totalProcessed} categories and deleted ${totalDeleted} categories`)
}

export const config: CronJobConfig = {
  name: 'meilisearch-categories-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
