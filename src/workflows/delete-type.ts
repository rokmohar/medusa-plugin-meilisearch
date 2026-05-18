import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteTypeStep } from './steps/delete-type'

type WorkflowInput = {
  id: string
}

export const deleteTypeWorkflow = createWorkflow('meilisearch-delete-type', ({ id }: WorkflowInput) => {
  const { products } = deleteTypeStep({ typeId: id })

  return new WorkflowResponse({ products })
})
