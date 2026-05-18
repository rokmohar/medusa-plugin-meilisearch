import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertOptionStep } from './steps/upsert-option'

type WorkflowInput = {
  id: string
}

export const upsertOptionWorkflow = createWorkflow('meilisearch-upsert-option', ({ id }: WorkflowInput) => {
  const { products } = upsertOptionStep({ optionId: id })

  return new WorkflowResponse({ products })
})
