import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteOptionStep } from './steps/delete-option'

type WorkflowInput = {
  id: string
}

export const deleteOptionWorkflow = createWorkflow('meilisearch-delete-option', ({ id }: WorkflowInput) => {
  const { products } = deleteOptionStep({ optionId: id })

  return new WorkflowResponse({ products })
})
