import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import productCreatedWorkflow from '../workflows/product-created'

export default async function meilisearchProductCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await productCreatedWorkflow(container).run({
    input: {
      id: data.id,
    },
  })
}

export const config: SubscriberConfig = {
  event: 'product.created',
}
