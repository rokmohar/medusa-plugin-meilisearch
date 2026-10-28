# Getting prices back from a search

`/store/meilisearch/products` hydrates its results through Medusa the way `/store/products` does, so prices come from
the pricing module and not from the index. With a `query`, Meilisearch decides the order and the `count`, and native
filters apply to the page it returns (see the [README](../README.md#get-storemeilisearchproducts)). Pricing follows the
native route. Ask for prices with the usual parameters:

```bash
curl 'http://localhost:9000/store/meilisearch/products?query=shirt&region_id=reg_1&fields=id,title,handle,*variants.calculated_price' \
  -H 'x-publishable-api-key: pk_...'
```

| Parameter      | Effect                                                            |
| -------------- | ----------------------------------------------------------------- |
| `fields`       | Which price fields to include, e.g. `*variants.calculated_price`. |
| `region_id`    | Region whose currency, prices and tax rules apply.                |
| `country_code` | Refines tax calculation.                                          |
| `province`     | Refines tax calculation within the country.                       |
| `cart_id`      | Prices and taxes for the cart's region and address.               |

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

The response carries calculated prices on the same terms as the native route. Tax-inclusive amounts such as
`calculated_amount_with_tax` need a tax context, for example `country_code`, and stock needs
`+variants.inventory_quantity` in `fields`:

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

## Prices and the `*-hits` routes

`/store/meilisearch/products-hits` answers straight from the engine without touching the database, so it returns only
indexed fields and never calculated or customer-group prices; index documents are shared by every caller. Use it for
autocomplete and facet browsing, and this route when the page needs prices. If you want price data on the hits route,
it has to be in the index: see [indexing variant prices](./faq-product-variant-prices.md).
