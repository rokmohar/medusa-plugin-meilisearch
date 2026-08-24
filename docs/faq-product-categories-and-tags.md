# How to include product categories and tags in search

The default product index already carries categories and tags as nested objects, searchable and facetable:

```
categories.id      keyword, filterable, facetable
categories.name    text, searchable (weight 2), facetable
categories.handle  keyword, filterable
tags.id            keyword, filterable
tags.value         text, searchable, facetable
```

So filtering and faceting works out of the box:

```ts
const search = container.resolve(Modules.SEARCH)

const { hits, facets } = await search.search({
  entity: 'products',
  filters: { q: 'shirt', 'categories.id': 'pcat_01' },
  search_options: { facets: ['categories.name', 'tags.value'] },
})
```

From a store request, use a raw Meilisearch filter:

```bash
curl 'http://localhost:9000/store/meilisearch/products-hits?query=shirt&filter=categories.id%20%3D%20pcat_01&facets=categories.name' \
  -H 'x-publishable-api-key: pk_...'
```

## Flattening them instead

Meilisearch flattens arrays of objects internally, so a filter on `categories.id` cannot be constrained to the same
element as a filter on `categories.name`. If you want flat arrays of ids and names — cheaper facets, simpler client
code — declare them and fill them in `transform`:

```ts
// src/search/products.ts
import { search } from '@medusajs/framework/utils'
import { defineProductSearchIndex, productSearchSchema } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex({
  fields: search.define({
    ...productSearchSchema(),
    category_ids: search.keyword().array().filterable(),
    category_names: search.text().array().searchable({ weight: 2 }).facetable(),
    tag_values: search.text().array().searchable().facetable(),
  }),
  transform: (product) => {
    const categories = Array.isArray(product.categories) ? product.categories : []
    const tags = Array.isArray(product.tags) ? product.tags : []

    return {
      ...product,
      id: String(product.id),
      category_ids: categories.map((category) => category.id),
      category_names: categories.map((category) => category.name),
      tag_values: tags.map((tag) => tag.value),
    }
  },
})
```

`graph_fields` already fetches `categories.*` and `tags.*` paths the default schema needs, so nothing else is required.
Add to `graph_fields` only when you reference a path the defaults do not fetch.
