import { SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { categoryDeletedWorkflow } from '../workflows/category-deleted'

export default async function meilisearchCategoryDeletedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await categoryDeletedWorkflow(container).run({
    input: { id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: 'product-category.deleted',
}
