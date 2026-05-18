import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteTagStep } from './steps/delete-tag'

type WorkflowInput = {
  id: string
}

export const deleteTagWorkflow = createWorkflow('meilisearch-delete-tag', ({ id }: WorkflowInput) => {
  const { products } = deleteTagStep({ tagId: id })

  return new WorkflowResponse({ products })
})
