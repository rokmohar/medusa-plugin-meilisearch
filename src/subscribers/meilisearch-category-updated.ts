import { SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { categoryUpdatedWorkflow } from '../workflows/category-updated'

export default async function meilisearchCategoryUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await categoryUpdatedWorkflow(container).run({
    input: { id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: 'product-category.updated',
}
