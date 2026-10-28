# Meilisearch plugin for Medusa

[![npm version](https://img.shields.io/npm/v/@rokmohar/medusa-plugin-meilisearch)](https://www.npmjs.com/package/@rokmohar/medusa-plugin-meilisearch)
[![npm downloads](https://img.shields.io/npm/dm/@rokmohar/medusa-plugin-meilisearch)](https://www.npmjs.com/package/@rokmohar/medusa-plugin-meilisearch)
[![CI](https://github.com/rokmohar/medusa-plugin-meilisearch/actions/workflows/ci.yml/badge.svg)](https://github.com/rokmohar/medusa-plugin-meilisearch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/@rokmohar/medusa-plugin-meilisearch)](./LICENSE)

Meilisearch for Medusa v2 catalogs: full-text and hybrid search over products and categories, plus store endpoints that
mirror `/store/products` and `/store/product-categories` with Meilisearch ranking.

- [How it fits together](#how-it-fits-together)
- [What you get](#what-you-get)
- [Compatibility](#compatibility)
- [Installation](#installation)
- [Configuration](#configuration)
- [Internationalization](#internationalization)
- [Semantic search](#semantic-search)
- [Querying from code](#querying-from-code)
- [Storefront search with `POST /store/search`](#storefront-search-with-post-storesearch)
- [Store API endpoints](#store-api-endpoints)
- [Admin API endpoints](#admin-api-endpoints)
- [Environment variables](#environment-variables)
- [docker-compose](#docker-compose)
- [Documentation](#documentation)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## How it fits together

Medusa 2.19.0 introduced a Search Module of its own, and from v2.0.0 this plugin plugs into it as the Meilisearch
engine behind it. The division of labour:

| Who                                 | Does what                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Medusa's Search Module              | Creates and migrates indexes, seeds them, batches writes, routes catalog events, rebuilds on drift |
| This plugin's provider              | Turns index declarations into Meilisearch settings and queries into Meilisearch requests           |
| This plugin's factories             | Ship ready-made product and category declarations you can extend                                   |
| This plugin's routes and admin page | Native-parity store search, plus a settings screen for indexes and reindexing                      |

Practically, that means you no longer run any indexing code yourself. You declare what an index holds; Medusa keeps it
filled.

## What you get

- Every method of the provider contract, so the module can rebuild an index into a fresh version and activate it, batched
  multi-search, and write-task tracking so seeding knows when a batch has actually landed
- Declared field weights compiled into Meilisearch relevance ordering, with filterable, sortable and facetable
  attributes derived from the same declaration
- Value, range and statistical facets; highlighting and cropped snippets; estimated or exhaustive counts
- Hybrid search over Meilisearch embedders — OpenAI, Ollama, Hugging Face, a REST endpoint, or vectors you compute
- One index per locale, translated through Medusa's Translation Module
- An escape hatch at every level: raw Meilisearch settings per index, raw Meilisearch parameters per query
- Drop-in engine for Medusa's own `POST /store/search` and `@medusajs/instantsearch-adapter`, with product hits scoped
  to the publishable key's sales channels
- Store endpoints that keep native pricing, tax, `variants.inventory_quantity` and sales-channel scoping

## Compatibility

| Plugin   | Medusa            | Meilisearch server | Node       |
| -------- | ----------------- | ------------------ | ---------- |
| `~2.4.0` | `2.22.x`          | `>= 1.20`          | `>= 22.12` |
| `~2.3.0` | `2.21.1 – 2.21.x` | `>= 1.20`          | `>= 22.12` |
| `~2.2.0` | `2.21.x`          | `>= 1.20`          | `>= 22`    |
| `~2.1.0` | `2.20.x`          | `>= 1.20`          | `>= 22`    |
| `~2.0.0` | `2.19.x`          | `>= 1.20`          | `>= 22`    |
| `~1.4.3` | `>= 2.15 < 2.19`  | `>= 1.5`           | `>= 22`    |
| `~1.3.7` | `^2.13.4`         | `>= 1.5`           | `>= 20`    |
| `~1.0.1` | `^2.4.0`          | `>= 1.5`           | `>= 20`    |

The 2.19 release removed the search interface the v1 line was written against, so the two lines do not overlap: v1 stops
at Medusa 2.18, v2 starts at 2.19. Coming from v1, work through [the upgrade guide](./docs/migration.md).

Every 2.x row is pinned to one Medusa minor rather than a floor, because the Search Module has changed between minors,
and the ranges are `~` so a newer plugin minor built for another Medusa minor is never installed by accident. Medusa
2.20 made `listIndexes()` asynchronous and made it resolve to index records, which 2.0.0 cannot read. Medusa 2.21 then
narrowed index settings to what every engine can honour, changed the seed function to yield mutations rather than
documents, and took over index swapping. Engine-specific settings, localized indexes included, now live under
`settings.provider_options.meilisearch`. Medusa 2.22 left the module unchanged; 2.4.0 moves the peer range to it.

Within the 2.21 line, 2.3.0 requires Medusa 2.21.1, the patch that shipped `POST /store/search` and
`configureStoreSearch`.

Meilisearch 1.20 is the minimum supported server version. CI runs on Node 22.

The Meilisearch JS client is `^0.62.0`, which is published as ES modules only. The plugin's CommonJS build loads it via
Node's `require(esm)`, hence the Node 22.12 floor.

## Installation

```bash
npm install @rokmohar/medusa-plugin-meilisearch
# or
yarn add @rokmohar/medusa-plugin-meilisearch
# or
pnpm add @rokmohar/medusa-plugin-meilisearch
```

Medusa itself is a peer dependency, so pick the plugin version that matches your Medusa minor from the
[compatibility table](#compatibility).

## Configuration

Register the plugin (for its API routes and admin page) and the Search Module with this package as its provider:

```ts
// medusa-config.ts
import { defineConfig } from '@medusajs/framework/utils'

export default defineConfig({
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

Then declare your indexes under `src/search`. The application loads every file in that directory and hands the
declarations to the Search Module:

```ts
// src/search/products.ts
import { defineProductSearchIndex } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex()
```

```ts
// src/search/categories.ts
import { defineCategorySearchIndex } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineCategorySearchIndex()
```

Create the indexes, then start the app:

```bash
npx medusa db:migrate
npx medusa develop
```

`db:migrate` creates and migrates the physical Meilisearch indexes. On boot the Search Module seeds any index that was
just created, was emptied, or whose declaration changed; from then on it keeps them current from events. Indexes live
in Meilisearch and are never recreated at startup.

### Provider options

| Option                     | Type        | Description                                                                                         |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `config`                   | `Config`    | Meilisearch client config. `host` is required; `apiKey` is optional for keyless instances.          |
| `embedders`                | `Embedders` | Meilisearch embedders applied to every index this provider manages. Keys are the embedder names.    |
| `settings`                 | `Settings`  | Meilisearch settings applied below the settings derived from each declaration, e.g. `rankingRules`. |
| `task_timeout_ms`          | `number`    | How long to wait for a deferred write. Default `120000`.                                            |
| `task_polling_interval_ms` | `number`    | How often to poll for a write to land. Default `500`.                                               |

### Index factory options

Both `defineProductSearchIndex()` and `defineCategorySearchIndex()` take the same options and always return an array of
declarations (one per locale).

| Option           | Default                                                               | Description                                                                                     |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `name`           | `products` / `categories`                                             | Base index name.                                                                                |
| `provider`       | the module's default provider                                         | Provider identifier this index binds to.                                                        |
| `primary_key`    | `id`                                                                  | Document primary key.                                                                           |
| `fields`         | the default schema                                                    | Replaces the field schema. Use `search.define({ ... })`.                                        |
| `settings`       | `{}`                                                                  | Typo tolerance and distinct attribute, plus `provider_options.meilisearch` for engine settings. |
| `graph_fields`   | the default selection                                                 | Extra `query.graph` paths to fetch while seeding and ingesting.                                 |
| `filters`        | `{ status: 'published' }` / `{ is_active: true, is_internal: false }` | `query.graph` filters.                                                                          |
| `transform`      | pick of the declared paths                                            | Maps an entity to a search document. Synchronous; the document must keep `id`.                  |
| `query_context`  | –                                                                     | `query.graph` context (e.g. a pricing context), or a function of the ingestion context.         |
| `batch_size`     | `200`                                                                 | Seed page size.                                                                                 |
| `events`         | product / category events, both namespaces                            | Events this index reacts to.                                                                    |
| `consume`        | the default routing table                                             | Turns an event into index mutations.                                                            |
| `locales`        | –                                                                     | BCP-47 locales; emits one index per locale.                                                     |
| `default_locale` | first entry of `locales`                                              | Which locale keeps the bare index name.                                                         |

Extending the default schema:

```ts
import { search } from '@medusajs/framework/utils'
import { defineProductSearchIndex, productSearchSchema } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex({
  fields: search.define({
    ...productSearchSchema(),
    brand: search.text().searchable({ weight: 3 }).facetable(),
  }),
  graph_fields: ['brand'],
  settings: {
    provider_options: {
      meilisearch: {
        synonyms: { trousers: ['pants'] },
        stopWords: ['the'],
      },
    },
  },
})
```

Meilisearch has no per-attribute weights — relevance follows the order of `searchableAttributes` — so declared weights
become that ordering.

### Worker mode

Seeding and event ingestion run on instances whose `projectConfig.workerMode` is `shared` or `worker`, not `server`. In a
split deployment, install and configure the plugin on the worker instance too, or its indexes will stay empty.

## Internationalization

Pass `locales` to a factory to get one index per locale. The default locale keeps the bare name, the others are
suffixed:

```ts
export default defineProductSearchIndex({
  locales: ['en-US', 'fr-FR', 'de-DE'],
  default_locale: 'en-US',
})
```

This registers `products`, `products-fr-FR` and `products-de-DE`. Each index declares its locale, seeds and ingests
through `query.graph(..., { locale })` so documents carry the translated values, and tells Meilisearch which analyzer
to use. Localized reads require Medusa's Translation Module (`featureFlags: { translation: true }`).

Meilisearch ships analyzers for a fixed list of languages. A locale outside it — Icelandic, for one — still gets its
own index, its translated documents and its locale routing; only the analyzer declaration is left out, so Meilisearch
detects the language itself.

Store requests select an index by locale: `?locale=fr-FR` (or the `x-medusa-locale` header). Region variants fall back
to the same language, so `fr-CA` uses the `fr-FR` index when no `fr-CA` index exists, and an unknown locale falls back
to the default index. `?index=products-fr-FR` addresses one index directly.

## Semantic search

Configure Meilisearch embedders on the provider and query them with `semanticSearch`:

```ts
options: {
  config: { host: process.env.MEILISEARCH_HOST!, apiKey: process.env.MEILISEARCH_API_KEY },
  embedders: {
    default: {
      source: 'openAi',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
      dimensions: 1536,
      documentTemplate: '{{doc.title}} {{doc.description}}',
    },
  },
}
```

Declare embedders under `settings.provider_options.meilisearch.embedders` on an index to scope them to that index — the
**AI-Powered Semantic Search** card on the admin page reads declarations, so per-index embedders also show up there. Pre-computed embeddings are supported
by declaring a `search.vector(dimensions)` field. See [docs/semantic-search.md](./docs/semantic-search.md) for Ollama
and OpenAI walkthroughs.

## Querying from code

In an API route, workflow step or subscriber, resolve the Search Module from the container:

```ts
import { Modules } from '@medusajs/framework/utils'

// e.g. inside an API route handler
const searchModule = req.scope.resolve(Modules.SEARCH)

const { hits, facets, metadata } = await searchModule.search({
  entity: 'products',
  fields: ['id', 'title'],
  filters: { q: 'shirt', status: 'published' },
  pagination: { skip: 0, take: 20 },
  search_options: {
    facets: ['categories.name'],
    highlight: { fields: ['title'] },
    count: 'exact',
  },
})
```

`query.search(...)` does the same and additionally hydrates fields the index does not hold. Anything Meilisearch cannot
express — `$like` and `$prefix` filters, cursor pagination, the `any` matching strategy, query-time typo tolerance,
ascending relevance — raises an error instead of silently returning different results. Raw Meilisearch parameters go
through `search_options.provider_options.meilisearch`.

Reindex on demand:

```ts
await searchModule.reindex({ index: 'products', strategy: 'swap' })
```

## Storefront search with `POST /store/search`

Medusa's own store search route works against these indexes once you allow them. Add the native middleware to your
application's `src/api/middlewares.ts`:

```ts
import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'

export default defineMiddlewares({
  routes: [
    {
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            products: true,
            categories: true,
          },
        }),
      ],
    },
  ],
})
```

Allowed names are the registered index names, so a localized setup lists each one (`products-fr-FR` and so on) and the
storefront picks the index for its locale.

Medusa narrows every product index to `status = published` and to the sales channels of the request's publishable key.
The product declaration carries a filterable `sales_channel_ids` for that, filled from `sales_channels.id`. Editing a
product's channels emits `product.updated` and re-indexes it; adding products from the sales channel side emits
nothing, so reindex after bulk assignments.

The route returns indexed fields only, so anything a storefront card shows has to be declared on the index. For
calculated prices, inventory and other per-request values use `GET /store/meilisearch/products` below.

The [InstantSearch adapter](https://www.npmjs.com/package/@medusajs/instantsearch-adapter) speaks to the same route:

```ts
import { createInstantSearchAdapter } from '@medusajs/instantsearch-adapter'

const { searchClient } = createInstantSearchAdapter({ sdk, path: '/store/search' })
```

## Store API endpoints

Every store request needs the `x-publishable-api-key` header.

The hydrated `products` and `categories` endpoints are the way to combine Meilisearch ranking with native pricing. The
`*-hits` endpoints predate the native route and overlap with it; prefer `POST /store/search` in new storefronts.

All four endpoints accept the Meilisearch-specific parameters `query`, `index`, `language`, `semanticSearch`,
`semanticRatio`, `embedder` and `filter` (a raw Meilisearch filter expression). `sort`, `facets` and index `fields`
belong to the `*-hits` endpoints only; the hydrated endpoints validate the rest of their query like the native routes.

### `GET /store/meilisearch/products`

Everything the native `/store/products` accepts, plus the parameters above. Without `query` or `semanticSearch` it
behaves like the native route. With either, Meilisearch supplies the matching product ids, their ranking and the
`count`, and the response is hydrated natively: calculated prices, tax and `variants.inventory_quantity`. Currency
follows `region_id`; request `+variants.inventory_quantity` for stock.

Like `POST /store/search`, the search is narrowed to published products and to the request's sales channels (the
`sales_channel_id` you pass, or every channel of the publishable key), on each of `status` and `sales_channel_ids` the
index declares filterable. The default product index declares both. When searching:

- Results come back in relevance order; a native `order` is ignored.
- Native filters such as `category_id` or `collection_id` apply to the page Meilisearch returns, so a page can hold fewer
  than `limit` products and `count` does not reflect them. Express such filters through `filter` on indexed fields to
  keep paging exact.

```bash
curl 'http://localhost:9000/store/meilisearch/products?query=shirt&limit=10&region_id=reg_1&fields=id,title,*variants.calculated_price' \
  -H 'x-publishable-api-key: pk_...'
```

Response: `{ products, count, limit, offset }`.

### `GET /store/meilisearch/categories`

Same idea against the native `/store/product-categories`: active, public categories only, and products reached through
them are published ones. Response: `{ product_categories, count, limit, offset }` like the native route, plus the same
list under `categories`, the key earlier versions used.

### `GET /store/meilisearch/products-hits` and `GET /store/meilisearch/categories-hits`

Raw engine hits, with no database read: `{ hits, query, processingTimeMs, estimatedTotalHits, limit, offset }`, plus
`facets` when requested and `hybridSearch` / `semanticRatio` for a hybrid query. Each hit carries the index's
retrievable fields and `_score`. Additional parameters: `limit`, `offset`, `sort`, `facets`, `fields`. These endpoints
are not narrowed to the key's sales channels; pass a `filter` on `sales_channel_ids` yourself, or use
`POST /store/search`.

```bash
curl 'http://localhost:9000/store/meilisearch/products-hits?query=shirt&limit=5&facets=categories.name' \
  -H 'x-publishable-api-key: pk_...'
```

## Admin API endpoints

| Endpoint                                  | Description                                                           |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `GET /admin/meilisearch/indexes`          | Registered indexes with their entity, locales and retrievable fields. |
| `POST /admin/meilisearch/sync`            | Starts a reindex (`{ index?, strategy? }`) and returns immediately.   |
| `POST /admin/meilisearch/products-hits`   | Raw product hits, same body as the store endpoint.                    |
| `POST /admin/meilisearch/categories-hits` | Raw category hits.                                                    |
| `GET /admin/meilisearch/vector-status`    | Semantic-search status derived from the registered declarations.      |

Medusa's own dashboard search uses the core `/admin/search` endpoint and picks up these indexes automatically.

## Environment variables

```bash
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your_master_key
```

## docker-compose

```yaml
services:
  meilisearch:
    image: getmeili/meilisearch:v1.53
    ports:
      - '7700:7700'
    environment:
      MEILI_MASTER_KEY: your_master_key
      MEILI_NO_ANALYTICS: 'true'
    volumes:
      - meilisearch:/meili_data

volumes:
  meilisearch:
```

## Documentation

- [Add search to the Medusa DTC starter](./docs/nextjs/README.md)
- [Semantic search](./docs/semantic-search.md)
- [Upgrading from v1, and between v2 minors](./docs/migration.md)
- FAQ:
  - [Product categories and tags](./docs/faq-product-categories-and-tags.md)
  - [Product variant prices](./docs/faq-product-variant-prices.md)
  - [Product search prices](./docs/faq-product-search-prices.md)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) and the [GitHub releases](https://github.com/rokmohar/medusa-plugin-meilisearch/releases).

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](./CONTRIBUTING.md) covers the development setup, trying changes
in a Medusa app, and the pull request checklist. Everyone taking part follows the
[code of conduct](./CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities privately, as described in [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © Rok Mohar
