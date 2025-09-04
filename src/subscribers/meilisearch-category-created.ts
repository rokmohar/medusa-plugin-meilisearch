import { SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { categoryCreatedWorkflow } from '../workflows/category-created'

export default async function meilisearchCategoryCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await categoryCreatedWorkflow(container).run({
    input: { id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: 'product-category.created',
}
