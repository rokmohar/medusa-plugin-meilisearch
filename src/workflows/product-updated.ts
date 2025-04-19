import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertProductsStep } from './steps/upsert-products'
import { useQueryGraphStep } from '@medusajs/core-flows'

type WorkflowInput = {
  id: string
}

const productUpdatedWorkflow = createWorkflow('product-updated', (input: WorkflowInput) => {
  const { data: products } = useQueryGraphStep({
    entity: 'product',
    fields: ['*', 'categories.*', 'tags.*', 'variants.*', 'variants.prices.*'],
    filters: {
      id: input.id,
    },
  })
  upsertProductsStep({ products })

  return new WorkflowResponse({
    products,
  })
})

export default productUpdatedWorkflow
