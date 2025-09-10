# How to Include Product Categories and Tags in Search

This guide explains how to include product categories and tags in your MeiliSearch index so they can be used for filtering and searching.

## Solution

In your plugin configuration, specify the fields that should be loaded for products, including the relations:

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
        // Include relations in the fields array
        fields: [
          'id',
          'title',
          'description',
          'handle',
          'variant_sku',
          'thumbnail',
          'collection_id'
          'categories.*', // Include all category fields
          'tags.*',       // Include all tag fields
        ],
        indexSettings: {
          searchableAttributes: ['title', 'description', 'variant_sku', 'category_names', 'tag_values'],
          displayedAttributes: ['id', 'handle', 'title', 'description', 'variant_sku', 'thumbnail', 'collection_id', 'category_ids', 'category_names', 'tag_ids', 'tag_values'],
          filterableAttributes: ['id', 'handle', 'collection_id', 'category_ids', 'tag_ids'],
        },
        primaryKey: 'id',
        // Custom transformer with relations
        transformer: async (product) => {
          const cats = product.categories ?? [];
          const tags = product.tags ?? [];

          return {
            id: product.id,
            title: product.title,
            handle: product.handle,
            description: product.description ?? null,
            thumbnail: product.thumbnail ?? null,
            collection_id: product.collection_id ?? null,
            category_ids: cats.map((c: any) => c.id),
            category_names: cats.map((c: any) => c.name),
            tag_ids: tags.map((t: any) => t.id),
            tag_values: tags.map((t: any) => t.value),
          };
        },
      },
    },
    // ... other config
  } satisfies MeilisearchPluginOptions,
}
```
