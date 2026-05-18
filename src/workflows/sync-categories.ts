import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { syncCategoriesStep } from './steps/sync-categories'
import { RemoteQueryFilters } from '@medusajs/types'

export type SyncCategoriesWorkflowInput = {
  filters?: RemoteQueryFilters<'product_category'>
  batchSize?: number
}

export const syncCategoriesWorkflow = createWorkflow(
  'sync-categories',
  ({ filters, batchSize }: SyncCategoriesWorkflowInput) => {
    const { totalProcessed, totalDeleted } = syncCategoriesStep({ filters, batchSize })

    return new WorkflowResponse({
      totalProcessed,
      totalDeleted,
    })
  },
)
