# Meilisearch plugin for Medusa V2

## Installation

Run the following command to install the plugin with **npm**:

```bash
npm install --save @rokmohar/medusa-plugin-meilisearch
```

Or with **yarn**:

```bash
yarn add @rokmohar/medusa-plugin-meilisearch
```

### Upgrade v0.1 to v0.2

*This step is required only if you are upgrading from v0.1 to v0.2. The plugin now supports MedusaJS v2.2.*

Service was renamed from `@rokmohar/medusa-plugin-meilisearch` to `meilisearch`.
You will need to adjust your custom `subscribers` accordingly.

## Configuration

Add the plugin to your `medusa-config.ts` file:

```js
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  // ... other config
  modules: [
    // ... other modules
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
              displayedAttributes: ['id', 'title', 'description', 'variant_sku', 'thumbnail', 'handle'],
            },
            primaryKey: 'id',
            // Create your own transformer
            /*transformer: (product) => ({
              id: product.id,
              // other attributes...
            }),*/
          },
        },
      },
    },
  ],
})
```

## ENV variables

Add the environment variables to your `.env` and `.env.template` file:

```env
# ... others vars
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=
```

If you want to use with the `docker-compose` from this README, use the following values:

```env
# ... others vars
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=ms
```

## Subscribers

You must add the following subscribers to the `src/subscribers`:

### product-upsert.ts

```js
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Modules } from '@medusajs/framework/utils'
import { ProductEvents, SearchUtils } from '@medusajs/utils'

export default async function productUpsertHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const productModuleService = container.resolve(Modules.PRODUCT)
  const meiliSearchService = container.resolve('meilisearch')

  const product = await productModuleService.retrieveProduct(productId)
  await meiliSearchService.addDocuments('products', [product], SearchUtils.indexTypes.PRODUCTS)
}

export const config: SubscriberConfig = {
  event: [ProductEvents.PRODUCT_CREATED, ProductEvents.PRODUCT_UPDATED],
}
```

### product-delete.ts

```js
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'

export default async function productDeleteHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
    const productId = data.id

    const meiliSearchService = container.resolve('meilisearch')
    await meiliSearchService.deleteDocument('products', productId)
}

export const config: SubscriberConfig = {
    event: ProductEvents.PRODUCT_DELETED,
}
```

## docker-compose

You can add the following configuration for Meilisearch to your `docker-compose.yml`:

```yml
services:
  # ... other services

  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - "7700:7700"
    volumes:
      - ~/data.ms:/data.ms
    environment:
      - MEILI_MASTER_KEY=ms
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## Add search to Medusa NextJS starter

You can find instructions on how to add search to a Medusa NextJS starter inside the [nextjs](nextjs) folder.
