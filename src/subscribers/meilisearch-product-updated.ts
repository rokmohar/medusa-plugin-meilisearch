import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import productUpdatedWorkflow from '../workflows/product-updated'

export default async function meilisearchProductUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await productUpdatedWorkflow(container).run({
    input: {
      id: data.id,
    },
  })
}

export const config: SubscriberConfig = {
  event: 'product.updated',
}
