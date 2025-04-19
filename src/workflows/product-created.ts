import { createWorkflow, WorkflowResponse } from '@medusajs/framework/dist/workflows-sdk'
import { retrieveProductStep } from './steps/retrieve-product'
import { getProductIndexesStep } from './steps/get-product-indexes'
import { addToIndexesStep } from './steps/add-to-indexes'

type WorkflowInput = {
  id: string
}

const productCreatedWorkflow = createWorkflow('product-created', (input: WorkflowInput) => {
  const product = retrieveProductStep(input)
  const indexes = getProductIndexesStep()
  addToIndexesStep({ product, indexes })

  return new WorkflowResponse({})
})

export default productCreatedWorkflow
