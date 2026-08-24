# Indexing variant prices

The shipped product schema deliberately holds no prices. Prices depend on region, currency, customer group and price
lists, so a single indexed number is only ever right for one context — and it goes stale whenever a price changes.
Prefer asking `/store/meilisearch/products` for calculated prices, which resolves them per request
([details](./faq-product-search-prices.md)).

Indexing a price is still worth it for one job: sorting and range-filtering a result list by a "from" price. Do it with
a denormalized field per currency you actually sort on.

## Declaring the fields

```ts
// src/search/products.ts
import { search } from '@medusajs/framework/utils'
import { defineProductSearchIndex, productSearchSchema } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex({
  fields: search.define({
    ...productSearchSchema(),
    min_price_usd: search
      .float()
      .filterable()
      .sortable()
      .facetable({ types: ['range', 'stats'] }),
  }),
  graph_fields: ['variants.prices.amount', 'variants.prices.currency_code', 'variants.prices.price_list_id'],
  transform: (product) => {
    const variants = Array.isArray(product.variants) ? product.variants : []

    const amounts = variants.flatMap((variant) => {
      const prices = Array.isArray(variant.prices) ? variant.prices : []

      return prices
        .filter((price) => price.currency_code === 'usd' && !price.price_list_id)
        .map((price) => price.amount)
    })

    return {
      ...product,
      id: String(product.id),
      min_price_usd: amounts.length ? Math.min(...amounts) : undefined,
    }
  },
})
```

`graph_fields` is what makes the price rows available to `transform`; without those paths the variants arrive without
prices. Excluding `price_list_id` keeps promotional prices out of the sort key, which is usually what a "from" price
should show.

Sorting and filtering then work through the normal query options:

```ts
await search.search({
  entity: 'products',
  filters: { q: 'shirt', min_price_usd: { $lte: 5000 } },
  pagination: { order: { min_price_usd: 'ASC' } },
})
```

Or through a store request: `?query=shirt&sort=min_price_usd:asc&filter=min_price_usd%20%3C%3D%205000`.

## Keeping the value current

Price changes do not reach the index on their own. The default declaration subscribes to product and product-relation
events only, because the shipped schema has nothing that price events could invalidate. Add them yourself when you
index a price:

```ts
import { PricingEvents } from '@medusajs/framework/utils'
import { PRODUCT_EVENTS } from '@rokmohar/medusa-plugin-meilisearch/indexes'

export default defineProductSearchIndex({
  // fields, graph_fields and transform as above
  events: [...PRODUCT_EVENTS, PricingEvents.PRICE_CREATED, PricingEvents.PRICE_UPDATED, PricingEvents.PRICE_DELETED],
  consume: async (event, context) => {
    // resolve the affected product ids for a price event, then return
    // [{ action: 'upsert', documents }] for them
  },
})
```

A price event carries a price id, so `consume` has to walk back to the product — price set, then variant, then product —
using `context.container.query`. If that traversal is more than you want to own, leave price events out and rebuild
periodically instead: `searchModule.reindex({ index: 'products' })` from a scheduled job re-reads every price.
