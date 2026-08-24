# Upgrading from v1 to v2

## Why the upgrade is a rewrite

Medusa 2.19.0 shipped a first-party Search Module and dropped `SearchUtils.AbstractSearchService` and
`SearchUtils.indexTypes` — the two interfaces v1 of this plugin was built on. v1 therefore cannot boot on 2.19, and v2
cannot boot below it. Pick the line that matches your Medusa version:

| Your Medusa      | Use                                                          |
| ---------------- | ------------------------------------------------------------ |
| `>= 2.15 < 2.19` | `@rokmohar/medusa-plugin-meilisearch@^1.4.3` (branch `v1.x`) |
| `^2.19.0`        | `@rokmohar/medusa-plugin-meilisearch@^2.0.0`                 |

The upgrade is mostly deletion. In v1 the plugin ran its own module, 23 event subscribers, 24 workflows and 2 cron jobs
to keep Meilisearch in step with the catalog. All of that now belongs to the Search Module: it creates and migrates
indexes, seeds them, batches writes, routes events, and rebuilds an index when its declaration changes. What is left
for this package is translating declarations and queries into Meilisearch.

Meilisearch server 1.20 or newer is required.

## Where your v1 configuration ends up

v1 had one plugin options object. v2 splits it in three, by lifetime:

- **connection and engine-wide settings** → provider options in the `modules` entry, read once at boot
- **what an index contains** → one declaration file per index under `src/search`, hashed so the module can detect drift
- **how a request searches** → query options, per request

That split is why there is no mechanical translation of the old `settings` object: the parts of it went to different
places.

### Reference table

| v1 option                                          | v2 home                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `config`                                           | provider `options.config`                                                   |
| `settings.<index>`                                 | a file under `src/search` calling a factory                                 |
| `settings.<index>.type`                            | which factory you call                                                      |
| `settings.<index>.enabled: false`                  | delete the file                                                             |
| `settings.<index>.fields`                          | `graph_fields` — what to read from the database                             |
| `settings.<index>.primaryKey`                      | `primary_key`                                                               |
| `indexSettings.searchableAttributes`               | `.searchable({ weight })` per field; the weights become the attribute order |
| `indexSettings.filterableAttributes`               | `.filterable()`, or `.facetable()` when you also want counts                |
| `indexSettings.sortableAttributes`                 | `.sortable()`                                                               |
| `indexSettings.displayedAttributes`                | every field, unless you mark it `.retrievable(false)`                       |
| `indexSettings.synonyms`                           | `settings.synonyms`                                                         |
| `indexSettings.stopWords`                          | `settings.stop_words`                                                       |
| `indexSettings.typoTolerance`                      | `settings.typo_tolerance`                                                   |
| anything else Meilisearch-specific                 | `settings.provider_options.meilisearch`                                     |
| `transformer`                                      | `transform`                                                                 |
| `i18n.strategy: 'separate-index'`                  | `locales`                                                                   |
| `i18n.strategy: 'field-suffix'`                    | no equivalent — see [Localized indexes](#localized-indexes)                 |
| `i18n.translatableFields`, translation transformer | Medusa's Translation Module                                                 |
| `vectorSearch`                                     | Meilisearch `embedders`                                                     |
| `meilisearch.sync` event, cron jobs, subscribers   | `searchModule.reindex()` and the declaration's `events` / `consume`         |

## Install

```bash
yarn add @medusajs/medusa@^2.19.0 @medusajs/framework@^2.19.0 @rokmohar/medusa-plugin-meilisearch@^2.0.0
```

## Rewriting medusa-config.ts

The plugin entry stays (it serves the API routes and the admin page) but carries no options. Everything Meilisearch
needs to connect moves into the Search Module's provider list:

```ts
// before
plugins: [
  {
    resolve: '@rokmohar/medusa-plugin-meilisearch',
    options: {
      config: { host: process.env.MEILISEARCH_HOST, apiKey: process.env.MEILISEARCH_API_KEY },
      settings: {
        products: {
          type: 'products',
          fields: ['id', 'title', 'description', 'handle', 'variant_sku', 'thumbnail'],
          indexSettings: {
            searchableAttributes: ['title', 'description', 'variant_sku'],
            filterableAttributes: ['id', 'handle'],
          },
          primaryKey: 'id',
        },
      },
    },
  },
]

// after
plugins: [{ resolve: '@rokmohar/medusa-plugin-meilisearch', options: {} }],
modules: [
  {
    resolve: '@medusajs/medusa/search',
    options: {
      providers: [
        {
          resolve: '@rokmohar/medusa-plugin-meilisearch/providers/meilisearch',
          id: 'meilisearch',
          options: {
            config: { host: process.env.MEILISEARCH_HOST!, apiKey: process.env.MEILISEARCH_API_KEY },
          },
        },
      ],
    },
  },
]
```

## Declaring the indexes

Each key of the old `settings` object becomes a file. The factories carry the defaults, so a configuration that only
listed the recommended fields collapses to one line:

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

Anything you customised in v1 becomes a factory option — `name`, `fields`, `settings`, `graph_fields`, `filters`. Note
that the shipped schema nests relations instead of flattening them: v1's `variant_sku` is now `variants.sku`, and
categories, tags, collection and type are nested objects. Storefront code that read `variant_sku` needs updating; see
[the categories and tags FAQ](./faq-product-categories-and-tags.md) if you prefer flat arrays.

A field's weight now expresses relevance directly, replacing the hand-ordered `searchableAttributes` list:

```ts
import { search } from '@medusajs/framework/utils'
import { defineProductSearchIndex, productSearchSchema } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex({
  fields: search.define({
    ...productSearchSchema(),
    brand: search.text().searchable({ weight: 3 }).facetable(),
  }),
  graph_fields: ['brand'],
  settings: { synonyms: { trousers: ['pants'] } },
})
```

## Porting a transformer

v1 transformers were asynchronous, were handed a default transformer to build on, and could resolve services from the
container to fetch whatever the configured `fields` had missed. v2 transforms are synchronous, receive the already
hydrated entity, and return the document:

```ts
// v1
transformer: async (product, defaultTransformer) => ({
  ...defaultTransformer(product),
  brand: product.brand?.name,
})

// v2
transform: (product) => ({
  ...product,
  id: String(product.id),
  brand: (product.brand as { name?: string } | undefined)?.name,
})
```

If your transformer fetched data, move those paths into `graph_fields` — the entity arrives with them already loaded,
which is also why the container is no longer passed in. The second argument gives you the index name and its locale.

## Deleting the ingestion code

Remove anything you wrote to drive indexing: subscribers on product events, sync workflows, cron jobs, and any code
emitting `meilisearch.sync`. The declaration's `events` and `consume` replace them, and the Search Module runs them.
Where you previously triggered a full sync, call the module:

```ts
await container.resolve(Modules.SEARCH).reindex({ index: 'products', strategy: 'swap' })
```

Then create the indexes and boot:

```bash
npx medusa db:migrate   # creates and migrates the physical indexes
npx medusa develop      # seeds whatever is new, empty, or drifted
```

Seeding and ingestion do not run in `worker_mode: 'server'`, exactly as v1's subscribers and jobs did not.

## Reading results in your own code

```ts
// v1
const meili = container.resolve(MEILISEARCH_MODULE)
const { hits, estimatedTotalHits } = await meili.search('products', 'shirt', { paginationOptions: { limit: 20 } })

// v2
const search = container.resolve(Modules.SEARCH)
const { hits, metadata } = await search.search({
  entity: 'products',
  filters: { q: 'shirt' },
  pagination: { take: 20 },
})
```

Two differences worth noting: `entity` is the index name from your declaration, and a hit is
`{ id, score?, document, highlights? }` — the indexed fields sit under `document` rather than on the hit itself. Use
`query.search(...)` instead if you also want fields the index does not hold; it hydrates them through `query.graph`.

Queries now fail loudly on anything Meilisearch cannot answer faithfully — `$like` and `$prefix` filters, cursor
pagination, the `any` matching strategy, per-query typo tolerance, ascending relevance. Raw engine parameters still get
through, via `search_options.provider_options.meilisearch`.

## What your storefront sees

All four `/store/meilisearch/*` routes survive with their response envelopes intact, so a storefront reading
`products`, `count`, or the flat `hits` array keeps working. The behavioural changes:

- Pages past the first are correct now. v1 applied the offset twice, in Meilisearch and again in the database query, so
  `offset > 0` came back empty.
- A request queries one index instead of searching every index of a type and adding up the totals. Pass `index` to
  address a specific one.
- Hits carry the index's retrievable fields, not your old transformer's output. If the storefront reads a field that is
  no longer indexed, declare it in the schema and add its path to `graph_fields`.
- New parameters: `index`, `facets`, `fields`, `embedder`. `filter` and `sort` still accept raw Meilisearch syntax.
- `language` keeps working and is now interchangeable with Medusa's standard `?locale=`.
- Each hit includes `_score`, and `facets` comes back when requested.

## Localized indexes

The `separate-index` strategy becomes a list of locales on the factory:

```ts
export default defineProductSearchIndex({
  locales: ['en-US', 'fr-FR'],
  default_locale: 'en-US',
})
```

The default locale keeps the plain index name and the others are suffixed, so v1's `products_fr` becomes
`products-fr-FR`. Requests select one with `?locale=fr-FR`, and a regional variant falls back to its language, so
`fr-CA` reads the `fr-FR` index. Translated values now come from Medusa's Translation Module through
`query.graph(..., { locale })`, which is why `translatableFields` and custom translation transformers no longer exist.

The `field-suffix` strategy has no replacement. Either move to one index per locale, or keep a single index and emit the
suffixed fields yourself from a custom schema and `transform`.

## Embedders replace vectorSearch

v1 wrapped two embedding providers behind its own options. v2 hands Meilisearch's native embedder configuration
straight through, which covers `openAi`, `ollama`, `huggingFace`, `rest` and `userProvided`:

```ts
// v1
vectorSearch: {
  enabled: true,
  embedding: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY, model: 'text-embedding-3-small' },
  embeddingFields: ['title', 'description'],
}

// v2, in the provider options
embedders: {
  default: {
    source: 'openAi',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
    dimensions: 1536,
    documentTemplate: '{{doc.title}} {{doc.description}}',
  },
}
```

`embeddingFields` becomes `documentTemplate`. Query-time usage is unchanged: `semanticSearch=true` with an optional
`semanticRatio`, or `search_options.vector` from code. Full walkthroughs are in
[docs/semantic-search.md](./semantic-search.md).

## Removing the old indexes

v1's indexes were named after the keys of your `settings` object, and v2 will only reuse a name if you kept it. Confirm
the new indexes serve traffic, then drop the leftovers:

```bash
curl -X DELETE 'http://localhost:7700/indexes/products' -H 'Authorization: Bearer <MEILISEARCH_API_KEY>'
```

## If you are staying on v1 for now

Pin `@rokmohar/medusa-plugin-meilisearch@^1.4.3` and Medusa 2.18 or earlier. The v1 line is kept on the `v1.x` branch.
