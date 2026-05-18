import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertVariantStep } from './steps/upsert-variant'

type WorkflowInput = {
  id: string
}

export const upsertVariantWorkflow = createWorkflow('meilisearch-upsert-variant', ({ id }: WorkflowInput) => {
  const { products } = upsertVariantStep({ variantId: id })

  return new WorkflowResponse({
    products,
  })
})
