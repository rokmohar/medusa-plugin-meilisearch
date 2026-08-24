# MedusaJS v2 Meilisearch plugin

Meilisearch for Medusa v2 catalogs: full-text and hybrid search over products and categories, plus store endpoints you
can swap in for `/store/products` and `/store/product-categories` without your storefront noticing.

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

- Every method of the provider contract, including atomic index swaps for rebuilds without downtime, batched
  multi-search, and write-task tracking so seeding knows when a batch has actually landed
- Declared field weights compiled into Meilisearch relevance ordering, with filterable, sortable and facetable
  attributes derived from the same declaration
- Value, range and statistical facets; highlighting and cropped snippets; estimated or exhaustive counts
- Hybrid search over Meilisearch embedders — OpenAI, Ollama, Hugging Face, a REST endpoint, or vectors you compute
- One index per locale, translated through Medusa's Translation Module
- An escape hatch at every level: raw Meilisearch settings per index, raw Meilisearch parameters per query
- Store endpoints that keep native pricing, tax, `variants.inventory_quantity`, sales-channel scoping, filters and sorts

## Compatibility

| Plugin   | Medusa           | Meilisearch server | Node    |
| -------- | ---------------- | ------------------ | ------- |
| `^2.0.0` | `^2.19.0`        | `>= 1.20`          | `>= 22` |
| `^1.4.1` | `>= 2.15 < 2.19` | `>= 1.5`           | `>= 22` |
| `^1.3.7` | `^2.13.4`        | `>= 1.5`           | `>= 20` |
| `^1.0.1` | `^2.4.0`         | `>= 1.5`           | `>= 20` |

The 2.19 release removed the search interface the v1 line was written against, so the two lines do not overlap: v1 stops
at Medusa 2.18, v2 starts at 2.19. Coming from v1, work through [the upgrade guide](./docs/migration.md).

The `>= 1.20` server floor comes from index swapping: the plugin's `swap` reindex strategy uses the `rename` field that
Meilisearch 1.20 added to `POST /swap-indexes`. Medusa 2.19 itself still runs on Node 20.19+, but this plugin is built
and tested on Node 22 only.

The Meilisearch JS client stays on `^0.56.0`, the last version published as CommonJS.

## Installation

```bash
npm install --save @rokmohar/medusa-plugin-meilisearch
# or
yarn add @rokmohar/medusa-plugin-meilisearch
```

## Configuration

Register the plugin (for its API routes and admin page) and the Search Module with this package as its provider:

```ts
// medusa-config.ts
import { defineConfig, Modules } from '@medusajs/framework/utils'

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

| Option           | Default                                                               | Description                                                     |
| ---------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `name`           | `products` / `categories`                                             | Base index name.                                                |
| `provider`       | the module's default provider                                         | Provider identifier this index binds to.                        |
| `primary_key`    | `id`                                                                  | Document primary key.                                           |
| `fields`         | the default schema                                                    | Replaces the field schema. Use `search.define({ ... })`.        |
| `settings`       | `{}`                                                                  | Index settings (synonyms, stop words, typo tolerance, …).       |
| `graph_fields`   | the default selection                                                 | Extra `query.graph` paths to fetch while seeding and ingesting. |
| `filters`        | `{ status: 'published' }` / `{ is_active: true, is_internal: false }` | `query.graph` filters.                                          |
| `transform`      | pick of the declared paths                                            | Maps an entity to a search document. Synchronous.               |
| `batch_size`     | `200`                                                                 | Seed page size.                                                 |
| `events`         | product / category events, both namespaces                            | Events this index reacts to.                                    |
| `consume`        | the default routing table                                             | Turns an event into index mutations.                            |
| `locales`        | –                                                                     | BCP-47 locales; emits one index per locale.                     |
| `default_locale` | first entry of `locales`                                              | Which locale keeps the bare index name.                         |

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
    synonyms: { trousers: ['pants'] },
    stop_words: ['the'],
  },
})
```

Meilisearch has no per-attribute weights — relevance follows the order of `searchableAttributes` — so declared weights
become that ordering.

### Worker mode

Seeding and event ingestion run outside `worker_mode: 'server'`. In a split deployment, install and configure the
plugin on the worker instance too, or its indexes will stay empty.

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
admin status card reads declarations, so per-index embedders also show up there. Pre-computed embeddings are supported
by declaring a `search.vector(dimensions)` field. See [docs/semantic-search.md](./docs/semantic-search.md) for Ollama
and OpenAI walkthroughs.

## Querying from code

```ts
import { Modules } from '@medusajs/framework/utils'

const search = container.resolve(Modules.SEARCH)

const { hits, facets, metadata } = await search.search({
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
await search.reindex({ index: 'products', strategy: 'swap' })
```

## Store API endpoints

All four endpoints accept the Meilisearch-specific parameters `query`, `index`, `language`, `semanticSearch`,
`semanticRatio`, `embedder` and `filter` (a raw Meilisearch filter expression).

### `GET /store/meilisearch/products`

Everything the native `/store/products` accepts, plus the parameters above. Without `query` it behaves exactly like the
native route. With one, Meilisearch supplies the matching product ids and their ranking, and the response is hydrated
natively — calculated prices, tax, `variants.inventory_quantity`, sales-channel scoping.

```bash
curl 'http://localhost:9000/store/meilisearch/products?query=shirt&limit=10&region_id=reg_1&fields=id,title,*variants.calculated_price' \
  -H 'x-publishable-api-key: pk_...'
```

Response: `{ products, count, limit, offset }`.

### `GET /store/meilisearch/categories`

Same idea against the native `/store/product-categories`. Response: `{ categories, count, limit, offset }`.

### `GET /store/meilisearch/products-hits` and `GET /store/meilisearch/categories-hits`

Raw engine hits, with no database read: `{ hits, query, processingTimeMs, estimatedTotalHits, limit, offset }`, plus
`facets` when requested and `hybridSearch` / `semanticRatio` for a hybrid query. Each hit carries the index's
retrievable fields and `_score`. Additional parameters: `limit`, `offset`, `sort`, `facets`, `fields`.

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

## Add search to the Medusa Next.js starter

See [nextjs/README.md](./nextjs/README.md).

## FAQ

- [Product categories and tags](./docs/faq-product-categories-and-tags.md)
- [Product variant prices](./docs/faq-product-variant-prices.md)
- [Product search prices](./docs/faq-product-search-prices.md)
- [Semantic search](./docs/semantic-search.md)
- [Migrating from v1](./docs/migration.md)

## Contributing

Issues and pull requests are welcome at
[github.com/rokmohar/medusa-plugin-meilisearch](https://github.com/rokmohar/medusa-plugin-meilisearch).

```bash
yarn install
yarn lint
yarn typecheck
yarn test
yarn build
```
