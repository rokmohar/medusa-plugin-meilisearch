import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { useQueryGraphStep } from '@medusajs/core-flows'
import { syncProductsStep } from './steps/sync-products'

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export const syncProductsWorkflow = createWorkflow(
  'sync-products',
  ({ filters, limit, offset }: SyncProductsWorkflowInput) => {
    const { data, metadata } = useQueryGraphStep({
      entity: 'product',
      fields: ['id', 'title', 'description', 'handle', 'thumbnail', 'categories.*', 'tags.*'],
      pagination: {
        take: limit,
        skip: offset,
      },
      filters: {
        status: 'published',
        ...filters,
      },
    })

    syncProductsStep({
      products: data,
    })

    return new WorkflowResponse({
      products: data,
      metadata,
    })
  },
)
