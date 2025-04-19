import { createWorkflow, WorkflowResponse } from '@medusajs/framework/dist/workflows-sdk'
import { retrieveProductStep } from './steps/retrieve-product'
import { getProductIndexesStep } from './steps/get-product-indexes'
import { addToIndexesStep } from './steps/add-to-indexes'
import { deleteFromIndexesStep } from './steps/delete-from-indexes'

type WorkflowInput = {
  id: string
}

const productUpdatedWorkflow = createWorkflow('product-updated', (input: WorkflowInput) => {
  const product = retrieveProductStep(input)
  const indexes = getProductIndexesStep()

  if (product.status === 'published') {
    addToIndexesStep({ product, indexes })
  } else {
    deleteFromIndexesStep({ id: product.id, indexes })
  }

  return new WorkflowResponse({})
})

export default productUpdatedWorkflow
