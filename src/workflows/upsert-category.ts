import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertCategoryStep } from './steps/upsert-category'

type WorkflowInput = {
  id: string
}

export const upsertCategoryWorkflow = createWorkflow('meilisearch-upsert-category', ({ id }: WorkflowInput) => {
  const result = upsertCategoryStep({ categoryId: id })

  return new WorkflowResponse(result)
})
