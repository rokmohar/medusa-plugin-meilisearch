import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import productDeletedWorkflow from '../workflows/product-deleted'

export default async function meilisearchProductDeletedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await productDeletedWorkflow(container).run({
    input: {
      id: data.id,
    },
  })
}

export const config: SubscriberConfig = {
  event: 'product.deleted',
}
