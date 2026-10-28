# Semantic search

Semantic (vector) search matches on meaning rather than on words: "warm winter clothing" finds a wool coat that never
uses either word. Hybrid search blends it with keyword matching, which is usually what you want in a catalog.

Embeddings are Meilisearch's own feature. This plugin passes your embedder configuration through to the engine and maps
query-time options onto Meilisearch's `hybrid` parameters, so every source Meilisearch supports works: `openAi`,
`ollama`, `huggingFace`, `rest` and `userProvided`.

For every source except `userProvided`, Meilisearch generates the embeddings itself, from a `documentTemplate` you
declare. Nothing needs to be embedded in Medusa, and existing documents are re-embedded when the embedder changes.
`userProvided` embeddings are covered under [Pre-computed embeddings](#pre-computed-embeddings).

## Configuring an embedder

Embedders declared on the provider apply to every index it manages:

```ts
// medusa-config.ts
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
            embedders: {
              default: {
                source: 'openAi',
                apiKey: process.env.OPENAI_API_KEY,
                model: 'text-embedding-3-small',
                dimensions: 1536,
                documentTemplate: '{{doc.title}} {{doc.description}}',
              },
            },
          },
        },
      ],
    },
  },
]
```

To scope an embedder to one index, declare it on the index instead. The admin page reads index declarations, so
per-index embedders also show up there:

```ts
// src/search/products.ts
import { defineProductSearchIndex } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex({
  settings: {
    provider_options: {
      meilisearch: {
        embedders: {
          default: {
            source: 'ollama',
            url: 'http://localhost:11434/api/embeddings',
            model: 'nomic-embed-text',
            dimensions: 768,
            documentTemplate: '{{doc.title}} {{doc.description}}',
          },
        },
      },
    },
  },
})
```

Embedder names matter. When a request doesn't name one through the `embedder` parameter, the endpoints use the first
embedder declared on the index, then one named `default`. Name a provider-level embedder `default` so it is picked up
without a parameter.

Keep `documentTemplate` short and specific. Every indexed document is sent to the embedding provider once, so a template
pulling in long descriptions costs more and usually retrieves worse.

## Running Ollama locally

```bash
ollama pull nomic-embed-text
ollama serve
```

Point the embedder's `url` at `http://localhost:11434/api/embeddings`, as in the per-index example above. If
Meilisearch runs in Docker while Ollama runs on the host, the container cannot reach `localhost`: use
`http://host.docker.internal:11434/api/embeddings`. On Linux, also start the container with
`--add-host=host.docker.internal:host-gateway`.

## Pre-computed embeddings

If you compute vectors yourself, declare a vector field. The provider registers a `userProvided` embedder named after
the field, and your `transform` copies the vector into the document. `transform` is synchronous, so the vector must
already be on the entity, for example stored in product metadata and fetched through `graph_fields`:

```ts
import { search } from '@medusajs/framework/utils'
import { defineProductSearchIndex, productSearchSchema } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex({
  fields: search.define({
    ...productSearchSchema(),
    embedding: search.vector(768),
  }),
  graph_fields: ['metadata'],
  transform: (product) => ({
    ...product,
    id: String(product.id),
    embedding: (product.metadata as { embedding?: number[] } | null)?.embedding,
  }),
})
```

`search.vector()` requires the dimensions, and the Search Module rejects a vector field without them when the app
boots.

Pre-computed embeddings have no text query to embed, so `semanticSearch=true` on such an index answers with a 400
unless the request names an `embedder` for a hybrid search. Otherwise query it from code with the vector you computed
for the search terms (see [From code](#from-code)).

To let Meilisearch embed a vector field instead, declare it with `embed()` and give the field its own embedder through
`provider_options.meilisearch.embedder`, for example `{ source: 'openAi', model: '...', documentTemplate: '...' }`.
`semanticSearch=true` then embeds the request's `query` against that field.

## Searching

The store and admin search endpoints take `semanticSearch`, `semanticRatio` and `embedder`:

| Parameter        | Default                                    | Description                                                   |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `semanticSearch` | `false`                                    | Blend semantic matching into the query.                       |
| `semanticRatio`  | `0.5`                                      | `0` is keyword-only, `1` is semantic-only, `0.5` is balanced. |
| `embedder`       | the index's first embedder, then `default` | Which declared embedder to use.                               |

```bash
curl 'http://localhost:9000/store/meilisearch/products-hits?query=warm+winter+clothing&semanticSearch=true&semanticRatio=0.7' \
  -H 'x-publishable-api-key: pk_...'
```

The `*-hits` responses add `hybridSearch: true` and the effective `semanticRatio`. The same parameters work on
`/store/meilisearch/products`, which hydrates the matches natively (prices, tax, inventory) and keeps its
`{ products, count, limit, offset }` response.

### From code

Pass Meilisearch's `hybrid` parameters through the provider options:

```ts
import { Modules } from '@medusajs/framework/utils'

const searchModule = container.resolve(Modules.SEARCH)

const { hits } = await searchModule.search({
  entity: 'products',
  filters: { q: 'warm winter clothing' },
  search_options: {
    provider_options: { meilisearch: { hybrid: { embedder: 'default', semanticRatio: 0.7 } } },
  },
})
```

For an index with pre-computed embeddings, pass your query vector through `search_options.vector`, where `field` is the
vector field:

```ts
const { hits } = await searchModule.search({
  entity: 'products',
  filters: { q: 'warm winter clothing' },
  search_options: { vector: { field: 'embedding', value: queryEmbedding, semantic_ratio: 0.7 } },
})
```

## Verifying and troubleshooting

On Medusa 2.21 and later the Search Module stores each index under a versioned physical name,
`<index_prefix>_<name>_v<N>`, or `<name>_v<N>` without a prefix: `products_v1` after the first migration, with the
number going up on each later migration or `swap` rebuild. List
the indexes first, then check what the engine stored:

```bash
curl 'http://localhost:7700/indexes' -H 'Authorization: Bearer <MEILISEARCH_API_KEY>'
curl 'http://localhost:7700/indexes/products_v1/settings/embedders' -H 'Authorization: Bearer <MEILISEARCH_API_KEY>'
```

- **No embedders listed.** The configuration never reached the engine. Embedders declared on an index are applied by
  `npx medusa db:migrate`. Embedders declared on the provider are not part of the index declaration, so apply them by
  rebuilding: `searchModule.reindex({ strategy: 'swap' })`, or **Sync Now** on the Meilisearch settings page in the
  admin.
- **Documents are indexed but semantic results are poor.** Check `documentTemplate` renders something meaningful; a
  template referencing a field that is not in the document produces empty embeddings.
- **Writes are slow after enabling an embedder.** Expected: every document is embedded before the write is applied, one
  round trip per batch to the embedding provider. Raise `task_timeout_ms` on the provider if seeding times out.
- **Semantic search shows as disabled in the admin.** The **AI-Powered Semantic Search** card on the Meilisearch
  settings page reads index declarations. Embedders declared only on the provider are invisible to it; declare them on
  the index to have them reported.

Semantic search needs Meilisearch 1.20 or newer, the same floor as the rest of this plugin.
