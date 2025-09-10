# How to Include Product Variant Prices in Search

This guide explains how to include product variant prices information (min_price, max_price) in your MeiliSearch index for filtering and sorting by price.

## Solution

In your plugin configuration, specify the fields that should be loaded for products, including variant pricing information:

```typescript
{
  resolve: '@rokmohar/medusa-plugin-meilisearch',
  options: {
    config: {
      host: process.env.MEILISEARCH_HOST ?? '',
      apiKey: process.env.MEILISEARCH_API_KEY ?? '',
    },
    settings: {
      products: {
        type: 'products',
        enabled: true,
        fields: [
          'id',
          'title',
          'description', 
          'handle',
          'thumbnail',
          'variants.prices.*', // Include variant prices
        ],
        indexSettings: {
          searchableAttributes: ['title', 'description'],
          displayedAttributes: [
            'id', 'handle', 'title', 'description', 'thumbnail',
            'min_price', 'max_price', 'currency_code', 'has_variants'
          ],
          filterableAttributes: [
            'id', 'handle', 'min_price', 'max_price', 'currency_code'
          ],
          // Enable sorting by price
          sortableAttributes: ['min_price', 'max_price'],
        },
        primaryKey: 'id',
        // Custom transformer to extract pricing
        transformer: async (product) => {
          // Calculate min_price from variant.prices array
          let min_price = null;
          let cheapest_variant_id = null;
          
          if (Array.isArray(product.variants)) {
            for (const variant of product.variants) {
              if (Array.isArray(variant.prices)) {
                const variantMin = variant.prices
                  .filter((p) => p.currency_code === 'eur' && !p.price_list_id)
                  .reduce((min, p) => (min === null || p.amount < min ? p.amount : min), null);

                if (variantMin !== null && (min_price === null || variantMin < min_price)) {
                  min_price = variantMin;
                  cheapest_variant_id = variant.id;
                }
              }
            }
          }

          return {
            ...product,
            min_price,
            cheapest_variant_id,
            // ... other fields
          };
        },
      },
    },
    // ... other config
  } satisfies MeilisearchPluginOptions,
}
```
