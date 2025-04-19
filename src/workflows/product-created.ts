import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { useQueryGraphStep } from '@medusajs/core-flows'
import { upsertProductsStep } from './steps/upsert-products'

type WorkflowInput = {
  id: string
}

const productCreatedWorkflow = createWorkflow('product-created', (input: WorkflowInput) => {
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

export default productCreatedWorkflow
