import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteOptionValueStep } from './steps/delete-option-value'

type WorkflowInput = {
  id: string
}

export const deleteOptionValueWorkflow = createWorkflow('meilisearch-delete-option-value', ({ id }: WorkflowInput) => {
  const { products } = deleteOptionValueStep({ optionValueId: id })

  return new WorkflowResponse({ products })
})
