import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertInventoryLevelStep } from './steps/upsert-inventory-level'

type WorkflowInput = {
  id: string
}

export const upsertInventoryLevelWorkflow = createWorkflow(
  'meilisearch-upsert-inventory-level',
  ({ id }: WorkflowInput) => {
    const { products } = upsertInventoryLevelStep({ inventoryLevelId: id })

    return new WorkflowResponse({ products })
  },
)
