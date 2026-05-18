import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { PricingEvents } from '@medusajs/utils'
import { deletePriceWorkflow } from '../workflows/delete-price'

export default async function meilisearchPriceDeleteHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await deletePriceWorkflow(container).run({
      input: { id: data.id },
    })
  } catch (error) {
    logger.error(toError(error))
    throw error
  }
}

export const config: SubscriberConfig = {
  event: [
    // Workflow events
    'price.deleted',
    // Module events
    PricingEvents.PRICE_DELETED,
  ],
}
