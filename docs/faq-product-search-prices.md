# Getting prices back from a search

`/store/meilisearch/products` hydrates its results through Medusa exactly like `/store/products` does, so prices come
from the pricing module and not from the index. Ask for them with the usual parameters:

```bash
curl 'http://localhost:9000/store/meilisearch/products?query=shirt&region_id=reg_1&fields=id,title,handle,*variants.calculated_price' \
  -H 'x-publishable-api-key: pk_...'
```

| Parameter       | Effect                                                            |
| --------------- | ----------------------------------------------------------------- |
| `fields`        | Which price fields to include, e.g. `*variants.calculated_price`. |
| `region_id`     | Region whose prices and tax rules apply.                          |
| `currency_code` | Currency to calculate in.                                         |
| `country_code`  | Refines tax calculation.                                          |

## Customer and customer-group prices

Price lists targeting a customer group apply automatically — as long as the request is authenticated as that customer.
The route runs Medusa's own pricing middleware, which reads the customer id off the token, looks up the groups that
customer belongs to, and puts them in the pricing context. Nothing has to be passed for it.

With the JS SDK, an authenticated storefront session is enough:

```ts
await sdk.client.fetch('/store/meilisearch/products', {
  query: {
    query: 'shirt',
    region_id: 'reg_1',
    fields: 'id,title,handle,*variants.calculated_price',
  },
})
```

The same call by hand, with a customer JWT:

```bash
curl 'http://localhost:9000/store/meilisearch/products?query=shirt&region_id=reg_1&fields=id,title,*variants.calculated_price' \
  -H 'x-publishable-api-key: pk_...' \
  -H 'Authorization: Bearer <customer_jwt>'
```

There is deliberately no `customer_id` or `customer_group_id` parameter. Group membership is derived from the token
server-side, so a caller holding only the publishable key cannot read prices negotiated for someone else. This matches
`/store/products` exactly.

If group prices still do not show up, check in order:

- the price list is `sale` or `override` and its rules target the customer group,
- it holds a price in the currency of the `region_id` you pass,
- the customer is actually a member of that group,
- the request carried the customer's token — an anonymous request prices from region and currency alone.

`-hits` responses can never carry group prices: index documents are shared by every caller. Search there for speed, then
hydrate through this route when the page needs prices.

The response carries calculated prices, tax-inclusive amounts and `variants.inventory_quantity` on the same terms as
the native route:

```json
{
  "products": [
    {
      "id": "prod_123",
      "title": "Cotton T-Shirt",
      "handle": "cotton-t-shirt",
      "variants": [
        {
          "id": "variant_456",
          "calculated_price": {
            "calculated_amount": 2999,
            "currency_code": "usd",
            "calculated_amount_with_tax": 3299
          }
        }
      ]
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 50
}
```

`/store/meilisearch/products-hits` is different: it answers straight from the engine without touching the database, so
it returns only indexed fields and never prices. Use it for autocomplete and facet browsing, and the full route when the
page needs prices. If you want price data on the hits route, it has to be in the index — see
[indexing variant prices](./faq-product-variant-prices.md).
