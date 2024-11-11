# medusa-plugin-meilisearch

## Installation

Run the following command to install the plugin:

```bash
npm install --save medusa-plugin-meilisearch
```

## Configuration

Add the plugin to your `medusa-config.js` file:

```js
module.exports = {
  plugins: [
    // other plugins
    {
      resolve: '@rokmohar/medusa-plugin-meilisearch',
      options: {
        config: {
          host: process.env.MEILISEARCH_HOST ?? '',
          apiKey: process.env.MEILISEARCH_API_KEY ?? '',
        },
        settings: {
          products: {
            indexSettings: {
              searchableAttributes: ['title', 'description', 'variant_sku'],
              displayedAttributes: ['title', 'description', 'variant_sku', 'thumbnail', 'handle'],
            },
            primaryKey: 'id',
          },
        },
      },
    },
  ],
};
```

## Subscribers

You must add the following subscribers to the src/subscribers:

### product-upsert.ts
```js
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { IProductModuleService } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { ProductEvents, SearchUtils } from '@medusajs/utils'
import MeiliSearchService from "@rokmohar/medusa-plugin-meilisearch";

export default async function productUpsertHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT)
  const meiliSearchService: MeiliSearchService = container.resolve('@rokmohar/medusa-plugin-meilisearch')

  const product = await productModuleService.retrieveProduct(productId)
  await meiliSearchService.addDocuments('products', [product], SearchUtils.indexTypes.PRODUCTS)
}

export const config: SubscriberConfig = {
  event: [ProductEvents.PRODUCT_CREATED, ProductEvents.PRODUCT_UPDATED],
}
```

### product-delete.ts
```js
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import MeiliSearchService from "@rokmohar/medusa-plugin-meilisearch";

export default async function productDeleteHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
    const productId = data.id

    const meiliSearchService: MeiliSearchService = container.resolve('@rokmohar/medusa-plugin-meilisearch')
    await meiliSearchService.deleteDocument('products', productId)
}

export const config: SubscriberConfig = {
    event: ProductEvents.PRODUCT_DELETED,
}
```