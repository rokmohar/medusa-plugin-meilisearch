import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertCollectionStep } from './steps/upsert-collection'

type WorkflowInput = {
  id: string
}

export const upsertCollectionWorkflow = createWorkflow('meilisearch-upsert-collection', ({ id }: WorkflowInput) => {
  const { products } = upsertCollectionStep({ collectionId: id })

  return new WorkflowResponse({ products })
})
