import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertTypeStep } from './steps/upsert-type'

type WorkflowInput = {
  id: string
}

export const upsertTypeWorkflow = createWorkflow('meilisearch-upsert-type', ({ id }: WorkflowInput) => {
  const { products } = upsertTypeStep({ typeId: id })

  return new WorkflowResponse({ products })
})
