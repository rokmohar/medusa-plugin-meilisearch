import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertCategoryStep } from './steps/upsert-category'

export type CategoryUpdatedWorkflowInput = {
  id: string
}

export const categoryUpdatedWorkflow = createWorkflow('category-updated', (input: CategoryUpdatedWorkflowInput) => {
  const result = upsertCategoryStep(input)
  return new WorkflowResponse(result)
})
