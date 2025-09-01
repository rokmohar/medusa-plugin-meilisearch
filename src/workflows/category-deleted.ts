import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { deleteCategoryStep } from './steps/delete-category'

export type CategoryDeletedWorkflowInput = {
  id: string
}

export const categoryDeletedWorkflow = createWorkflow('category-deleted', (input: CategoryDeletedWorkflowInput) => {
  const result = deleteCategoryStep(input)
  return new WorkflowResponse(result)
})
