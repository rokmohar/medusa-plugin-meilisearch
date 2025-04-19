import { createWorkflow, WorkflowResponse } from '@medusajs/framework/dist/workflows-sdk'
import { getProductIndexesStep } from './steps/get-product-indexes'
import { deleteFromIndexesStep } from './steps/delete-from-indexes'

type WorkflowInput = {
  id: string
}

const productDeletedWorkflow = createWorkflow('product-deleted', (input: WorkflowInput) => {
  const indexes = getProductIndexesStep()
  deleteFromIndexesStep({ id: input.id, indexes })

  return new WorkflowResponse({})
})

export default productDeletedWorkflow
