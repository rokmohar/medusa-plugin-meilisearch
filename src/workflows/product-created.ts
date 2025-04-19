import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertProductStep } from './steps/upsert-product'

type WorkflowInput = {
  id: string
}

const productCreatedWorkflow = createWorkflow('product-created', ({ id }: WorkflowInput) => {
  const { products } = upsertProductStep({ id })

  return new WorkflowResponse({
    products,
  })
})

export default productCreatedWorkflow
