import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { deleteProductStep } from './steps/delete-product'

type WorkflowInput = {
  id: string
}

const productDeletedWorkflow = createWorkflow('product-deleted', ({ id }: WorkflowInput) => {
  deleteProductStep({ id })

  return new WorkflowResponse({})
})

export default productDeletedWorkflow
