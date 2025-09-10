import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { syncCategoriesStep } from './steps/sync-categories'

export type SyncCategoriesWorkflowInput = {
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export const syncCategoriesWorkflow = createWorkflow('sync-categories', (input: SyncCategoriesWorkflowInput) => {
  const result = syncCategoriesStep(input)
  return new WorkflowResponse(result)
})
