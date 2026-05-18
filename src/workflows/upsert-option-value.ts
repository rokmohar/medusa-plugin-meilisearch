import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertOptionValueStep } from './steps/upsert-option-value'

type WorkflowInput = {
  id: string
}

export const upsertOptionValueWorkflow = createWorkflow('meilisearch-upsert-option-value', ({ id }: WorkflowInput) => {
  const { products } = upsertOptionValueStep({ optionValueId: id })

  return new WorkflowResponse({ products })
})
