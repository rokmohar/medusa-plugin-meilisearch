import { MedusaContainer } from '@medusajs/framework'
import { syncCategoriesWorkflow } from '../workflows/sync-categories'
import { CronJobConfig } from '../models/CronJobConfig'

export default async function meilisearchCategoriesIndexJob(container: MedusaContainer) {
  const logger = container.resolve('logger')
  logger.info('Starting category indexing...')

  const {
    result: { categories },
  } = await syncCategoriesWorkflow(container).run({
    input: {},
  })

  logger.info(`Successfully indexed ${categories.length} categories`)
}

export const config: CronJobConfig = {
  name: 'meilisearch-categories-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
