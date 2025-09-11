import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { syncCategoriesStep } from './steps/sync-categories'
import { RemoteQueryFilters } from '@medusajs/types'

export type SyncCategoriesWorkflowInput = {
  filters?: RemoteQueryFilters<'product_category'>
  batchSize?: number
}

export const syncCategoriesWorkflow = createWorkflow('sync-categories', (input: SyncCategoriesWorkflowInput) => {
  const { totalProcessed, totalDeleted } = syncCategoriesStep(input)
  return new WorkflowResponse({
    totalProcessed,
    totalDeleted,
  })
})
