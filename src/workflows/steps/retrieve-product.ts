import { createStep, StepResponse } from '@medusajs/framework/dist/workflows-sdk'
import { Modules } from '@medusajs/utils'

type StepInput = {
  id: string
}

export const retrieveProductStep = createStep('retrieve-product', async (input: StepInput, { container }) => {
  const productModuleService = container.resolve(Modules.PRODUCT)
  const product = await productModuleService.retrieveProduct(input.id, {
    relations: ['*'],
  })
  return new StepResponse(product)
})
