import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deletePriceStep } from './steps/delete-price'

type WorkflowInput = {
  id: string
}

export const deletePriceWorkflow = createWorkflow('meilisearch-delete-price', ({ id }: WorkflowInput) => {
  const { products } = deletePriceStep({ priceId: id })

  return new WorkflowResponse({ products })
})
