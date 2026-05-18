import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteInventoryStep } from './steps/delete-inventory'

type WorkflowInput = {
  id: string
}

export const deleteInventoryWorkflow = createWorkflow('meilisearch-delete-inventory', ({ id }: WorkflowInput) => {
  const { products } = deleteInventoryStep({ inventoryItemId: id })

  return new WorkflowResponse({ products })
})
