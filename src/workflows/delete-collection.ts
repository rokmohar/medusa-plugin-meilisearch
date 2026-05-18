import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteCollectionStep } from './steps/delete-collection'

type WorkflowInput = {
  id: string
}

export const deleteCollectionWorkflow = createWorkflow('meilisearch-delete-collection', ({ id }: WorkflowInput) => {
  const { products } = deleteCollectionStep({ collectionId: id })

  return new WorkflowResponse({ products })
})
