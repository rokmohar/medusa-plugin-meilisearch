import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertProductStep } from './steps/upsert-product'

type WorkflowInput = {
  id: string
}

export const upsertProductWorkflow = createWorkflow('meilisearch-upsert-product', ({ id }: WorkflowInput) => {
  const { products } = upsertProductStep({ productId: id })

  return new WorkflowResponse({
    products,
  })
})
