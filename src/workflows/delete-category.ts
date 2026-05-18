import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteCategoryStep } from './steps/delete-category'

type WorkflowInput = {
  id: string
}

export const deleteCategoryWorkflow = createWorkflow('meilisearch-delete-category', ({ id }: WorkflowInput) => {
  deleteCategoryStep({ categoryId: id })

  return new WorkflowResponse({})
})
