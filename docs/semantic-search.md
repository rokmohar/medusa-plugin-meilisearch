# Semantic search

Semantic (vector) search matches on meaning rather than on words: "warm winter clothing" finds a wool coat that never
uses either word. Hybrid search blends it with keyword matching, which is usually what you want in a catalog.

Embeddings are Meilisearch's own feature. This plugin passes your embedder configuration through to the engine and maps
query-time options onto Meilisearch's `hybrid` parameters, so every source Meilisearch supports works: `openAi`,
`ollama`, `huggingFace`, `rest` and `userProvided`.

Meilisearch generates the embeddings itself, from a `documentTemplate` you declare. Nothing needs to be embedded in
Medusa, and existing documents are re-embedded when the embedder changes.

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

To scope an embedder to one index, declare it on the index instead. The admin status card reads index declarations, so
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

Embedder names matter: `default` is what the store and admin endpoints use unless a request names another one through
the `embedder` parameter.

## Ollama, locally

```bash
ollama pull nomic-embed-text
ollama serve
```

```ts
embedders: {
  default: {
    source: 'ollama',
    url: 'http://localhost:11434/api/embeddings',
    model: 'nomic-embed-text',
    dimensions: 768,
    documentTemplate: '{{doc.title}} {{doc.description}}',
  },
}
```

If Meilisearch runs in Docker while Ollama runs on the host, the container cannot reach `localhost` — use
`http://host.docker.internal:11434/api/embeddings`, or expose Ollama through a tunnel and point `url` at that.

## OpenAI

```ts
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

Keep `documentTemplate` short and specific. Every indexed document is sent to the embedding provider once, so a template
pulling in long descriptions costs more and usually retrieves worse.

## Pre-computed embeddings

If you compute vectors yourself, declare a vector field. The provider registers a `userProvided` embedder named after
the field, and your `transform` writes the vector into the document:

```ts
import { search } from '@medusajs/framework/utils'
import { defineProductSearchIndex, productSearchSchema } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex({
  fields: search.define({
    ...productSearchSchema(),
    embedding: search.vector(768),
  }),
  transform: (product) => ({
    ...product,
    id: String(product.id),
    embedding: myEmbedder(product),
  }),
})
```

A vector field without `dimensions` is rejected when the index is migrated rather than at query time.

## Environment variables

```bash
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your_master_key

# OpenAI
OPENAI_API_KEY=sk-...
```

## Searching

Store and admin endpoints take `semanticSearch`, `semanticRatio` and `embedder`:

| Parameter        | Default   | Description                                                   |
| ---------------- | --------- | ------------------------------------------------------------- |
| `semanticSearch` | `false`   | Blend semantic matching into the query.                       |
| `semanticRatio`  | `0.5`     | `0` is keyword-only, `1` is semantic-only, `0.5` is balanced. |
| `embedder`       | `default` | Which declared embedder to use.                               |

```bash
curl 'http://localhost:9000/store/meilisearch/products-hits?query=warm+winter+clothing&semanticSearch=true&semanticRatio=0.7' \
  -H 'x-publishable-api-key: pk_...'
```

The response adds `hybridSearch: true` and the effective `semanticRatio`. The same parameters work on
`/store/meilisearch/products`, which then hydrates the matches natively (prices, tax, inventory).

From code, use `search_options.vector`:

```ts
const search = container.resolve(Modules.SEARCH)

const { hits } = await search.search({
  entity: 'products',
  filters: { q: 'warm winter clothing' },
  search_options: { vector: { field: 'default', semantic_ratio: 0.7 } },
})
```

`field` names the embedder. Meilisearch embeds the text query itself, so `vector.query` must match the query in
`filters.q`; pass `vector.value` instead if you already hold an embedding.

## Verifying and troubleshooting

Check what the engine actually stored:

```bash
curl 'http://localhost:7700/indexes/products/settings/embedders' -H 'Authorization: Bearer <MEILISEARCH_API_KEY>'
```

- **No embedders listed.** The declaration never reached the engine — run `npx medusa db:migrate` after changing
  embedder configuration.
- **Documents are indexed but semantic results are poor.** Check `documentTemplate` renders something meaningful; a
  template referencing a field that is not in the document produces empty embeddings.
- **Writes are slow after enabling an embedder.** Expected: every document is embedded before the write is applied, one
  round trip per batch to the embedding provider. Raise `task_timeout_ms` on the provider if seeding times out.
- **Semantic status shows disabled in the admin.** The card reads index declarations. Embedders declared only on the
  provider are invisible to it — declare them on the index to have them reported.

Semantic search needs Meilisearch 1.20 or newer, the same floor as the rest of this plugin.
