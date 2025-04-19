import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteProductStep } from './steps/delete-product'

type WorkflowInput = {
  id: string
}

const productDeletedWorkflow = createWorkflow('product-deleted', (input: WorkflowInput) => {
  deleteProductStep({ id: input.id })
  return new WorkflowResponse({})
})

export default productDeletedWorkflow
