import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { syncProductsStep } from './steps/sync-products'

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export const syncProductsWorkflow = createWorkflow(
  'sync-products',
  ({ filters, limit, offset }: SyncProductsWorkflowInput) => {
    const { products } = syncProductsStep({ filters, limit, offset })

    return new WorkflowResponse({
      products,
    })
  },
)
