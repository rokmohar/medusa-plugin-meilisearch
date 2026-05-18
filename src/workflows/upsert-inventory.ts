import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertInventoryStep } from './steps/upsert-inventory'

type WorkflowInput = {
  id: string
}

export const upsertInventoryWorkflow = createWorkflow('meilisearch-upsert-inventory', ({ id }: WorkflowInput) => {
  const { products } = upsertInventoryStep({ inventoryItemId: id })

  return new WorkflowResponse({ products })
})
