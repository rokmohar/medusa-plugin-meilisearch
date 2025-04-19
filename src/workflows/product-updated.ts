import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertProductStep } from './steps/upsert-product'

type WorkflowInput = {
  id: string
}

const productUpdatedWorkflow = createWorkflow('product-updated', ({ id }: WorkflowInput) => {
  const { products } = upsertProductStep({ id })

  return new WorkflowResponse({
    products,
  })
})

export default productUpdatedWorkflow
