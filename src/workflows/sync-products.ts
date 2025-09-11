import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { syncProductsStep } from './steps/sync-products'
import { RemoteQueryFilters } from '@medusajs/types'

type SyncProductsWorkflowInput = {
  filters?: RemoteQueryFilters<'product_category'>
  batchSize?: number
}

export const syncProductsWorkflow = createWorkflow(
  'sync-products',
  ({ filters, batchSize }: SyncProductsWorkflowInput) => {
    const { totalProcessed, totalDeleted } = syncProductsStep({ filters, batchSize })

    return new WorkflowResponse({
      totalProcessed,
      totalDeleted,
    })
  },
)
