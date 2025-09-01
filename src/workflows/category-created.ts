import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertCategoryStep } from './steps/upsert-category'

export type CategoryCreatedWorkflowInput = {
  id: string
}

export const categoryCreatedWorkflow = createWorkflow('category-created', (input: CategoryCreatedWorkflowInput) => {
  const result = upsertCategoryStep(input)
  return new WorkflowResponse(result)
})
