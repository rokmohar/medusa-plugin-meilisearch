import { MedusaContainer } from '@medusajs/framework'
import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { CronJobConfig } from '../models/CronJobConfig'
import { syncProductsWorkflow } from '../workflows/sync-products'

/**
 * Wrapper workflow that uses runAsStep to properly handle container context.
 * This is required because jobs are wrapped as workflows by Medusa's Redis workflow engine,
 * and calling workflows directly with container.run() causes ContainerLike compatibility issues.
 */
const productsIndexJobWorkflow = createWorkflow('products-index-job-workflow', () => {
  const result = syncProductsWorkflow.runAsStep({
    input: {},
  })

  return new WorkflowResponse(result)
})

export default async function meilisearchProductsIndexJob(container: MedusaContainer) {
  const logger = container.resolve('logger')

  logger.info('Starting product indexing...')

  const {
    result: { totalProcessed, totalDeleted },
  } = await productsIndexJobWorkflow(container).run()

  logger.info(`Successfully indexed ${totalProcessed} products and deleted ${totalDeleted} products`)
}

export const config: CronJobConfig = {
  name: 'meilisearch-products-index',
  schedule: '* * * * *',
  numberOfExecutions: 1,
}
