import { MedusaContainer } from '@medusajs/framework'
import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { CronJobConfig } from '../models/CronJobConfig'
import { syncCategoriesWorkflow } from '../workflows/sync-categories'

/**
 * Wrapper workflow that uses runAsStep to properly handle container context.
 * This is required because jobs are wrapped as workflows by Medusa's Redis workflow engine,
 * and calling workflows directly with container.run() causes ContainerLike compatibility issues.
 */
const categoriesIndexJobWorkflow = createWorkflow('categories-index-job-workflow', () => {
  const result = syncCategoriesWorkflow.runAsStep({
    input: {},
  })

  return new WorkflowResponse(result)
})

export default async function meilisearchCategoriesIndexJob(container: MedusaContainer) {
  const logger = container.resolve('logger')

  logger.info('Starting category indexing...')

  const {
    result: { totalProcessed, totalDeleted },
  } = await categoriesIndexJobWorkflow(container).run()

  logger.info(`Successfully indexed ${totalProcessed} categories and deleted ${totalDeleted} categories`)
}

export const config: CronJobConfig = {
  name: 'meilisearch-categories-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
