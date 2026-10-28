# Meilisearch in the Medusa DTC starter

The [Medusa DTC starter](https://github.com/medusajs/dtc-starter) already searches through Medusa's Search Module: the
navbar search drawer and the `/store` listing query `POST /store/search` with `@medusajs/instantsearch-adapter`. Making
this plugin the module's provider moves both onto Meilisearch without touching the storefront. A small patch then
moves the `/search` results page onto the plugin's `GET /store/meilisearch/products`.

The storefront never talks to Meilisearch: it needs no Meilisearch client, host or key.

## 1. Meilisearch server

Run Meilisearch 1.20 or newer, for example with the [docker-compose snippet](../../README.md#docker-compose) from the
main README.

## 2. Backend

In `apps/backend`, install the plugin:

```bash
pnpm add @rokmohar/medusa-plugin-meilisearch@~2.4.0
```

Register it and make it the Search Module's provider in `medusa-config.ts`:

```ts
module.exports = defineConfig({
  projectConfig: {
    // ...
  },
  plugins: [
    {
      resolve: '@rokmohar/medusa-plugin-meilisearch',
      options: {},
    },
  ],
  modules: [
    {
      resolve: '@medusajs/medusa/search',
      options: {
        providers: [
          {
            resolve: '@rokmohar/medusa-plugin-meilisearch/providers/meilisearch',
            id: 'meilisearch',
            options: {
              config: {
                host: process.env.MEILISEARCH_HOST!,
                apiKey: process.env.MEILISEARCH_API_KEY,
              },
            },
          },
        ],
      },
    },
  ],
})
```

Add the connection to `apps/backend/.env`:

```bash
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=your_master_key
```

Keep the starter's own index declaration in `apps/backend/src/search/product.ts`. The drawer and the listing read its
fields (per-currency prices, option values, categories, labels), so don't replace it with `defineProductSearchIndex()`.
The plugin's store route finds it through its `entity: 'product'`, so the index name doesn't matter.

Create the index, then start the backend; it seeds Meilisearch on boot:

```bash
pnpm medusa db:migrate
pnpm dev
```

The navbar search and the `/store` listing, refinements included, now run on Meilisearch.

## 3. Search results page

Out of the box, `/search` lists products with `/store/products?q=`, a database text match. [search.patch](search.patch)
switches it to `GET /store/meilisearch/products`, which ranks the matches with Meilisearch and returns them as
regular store products, priced for the region and scoped to the publishable key's sales channels.

From the root of the DTC starter, download the patch and apply it:

```bash
curl -O https://raw.githubusercontent.com/rokmohar/medusa-plugin-meilisearch/main/docs/nextjs/search.patch
git apply search.patch
```

The patch adds `searchProducts` in `apps/storefront/src/lib/data/search.ts` and calls it from
`apps/storefront/src/app/[countryCode]/(main)/search/page.tsx`. The locale travels in the `x-medusa-locale` header the
starter already sends, so localized indexes and translated products follow the storefront's language.

## Starter version

The patch is made against
[dtc-starter@6965d8a](https://github.com/medusajs/dtc-starter/tree/6965d8ac4185740c521a2b26855258ea20817b8e)
(Medusa 2.22.1).
