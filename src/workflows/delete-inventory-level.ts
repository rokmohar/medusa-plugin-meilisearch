import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteInventoryLevelStep } from './steps/delete-inventory-level'

type WorkflowInput = {
  id: string
}

export const deleteInventoryLevelWorkflow = createWorkflow(
  'meilisearch-delete-inventory-level',
  ({ id }: WorkflowInput) => {
    const { products } = deleteInventoryLevelStep({ inventoryLevelId: id })

    return new WorkflowResponse({ products })
  },
)
