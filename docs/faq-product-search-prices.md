# How to Include Prices in Search Response

This guide explains how to include product pricing information in your search responses when using the `/store/meilisearch/products` endpoint.

## Solution

The endpoint automatically includes price calculations through Medusa's standard pricing system. Here's how to work with prices in your search responses:

### Basic Usage

Include price-related fields in your request using the `fields` parameter:

```bash
GET /store/meilisearch/products?query=shirt&region_id=us&currency_code=usd&fields=id,title,handle,*variants.calculated_price,*variants.prices
```

### API Parameters for Price Context

- **`fields`**: Include price-related fields in the response
- **`region_id`**: Specify the region to get region-specific pricing
- **`currency_code`**: Set the currency for price calculations

Prices are automatically calculated based on the provided `region_id` and `currency_code`.

### Example Response Structure

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
          "title": "Small / Red",
          "calculated_price": {
            "calculated_amount": 2999,
            "original_amount": 2999,
            "currency_code": "USD",
            "calculated_amount_with_tax": 3299,
            "original_amount_with_tax": 3299
          },
          "prices": [
            {
              "id": "price_789",
              "currency_code": "USD",
              "amount": 2999,
              "min_quantity": 1
            }
          ]
        }
      ]
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 50
}
```
