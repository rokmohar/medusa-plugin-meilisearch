import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertTagStep } from './steps/upsert-tag'

type WorkflowInput = {
  id: string
}

export const upsertTagWorkflow = createWorkflow('meilisearch-upsert-tag', ({ id }: WorkflowInput) => {
  const { products } = upsertTagStep({ tagId: id })

  return new WorkflowResponse({ products })
})
