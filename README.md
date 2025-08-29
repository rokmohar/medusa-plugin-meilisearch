# MedusaJS v2 MeiliSearch Plugin with i18n Support

This plugin integrates MeiliSearch with your Medusa e-commerce store and adds support for internationalization (i18n) of your product catalog.

## Features

- Full-text search for your Medusa store
- Real-time indexing
- Typo-tolerance
- Faceted search
- Internationalization (i18n) support with multiple strategies:
  1. Separate index per language
  2. Language-specific fields with suffix
- Flexible translation configuration
- Custom field transformations
- Automatic field detection

## Installation

Run the following command to install the plugin with **npm**:

```bash
npm install --save @rokmohar/medusa-plugin-meilisearch
```

Or with **yarn**:

```bash
yarn add @rokmohar/medusa-plugin-meilisearch
```

### Upgrade to v1.0

_This step is required only if you are upgrading from previous version to v1.0._

- The plugin now supports new MedusaJS plugin system.
- Subscribers are included in the plugin.
- You don't need custom subscribers anymore, you can remove them.

## ⚠️ MedusaJS v2.4.0 or newer

This plugin is only for MedusaJS v2.4.0 or newer.

If you are using MedusaJS v2.3.1 or older, please use the [older version of this plugin](https://github.com/rokmohar/medusa-plugin-meilisearch/tree/v0.2.1).

## Configuration

Add the plugin to your `medusa-config.ts` file:

```js
import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { MeilisearchPluginOptions } from '@rokmohar/medusa-plugin-meilisearch'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  // ... other config
  plugins: [
    // ... other plugins
    {
      resolve: '@rokmohar/medusa-plugin-meilisearch',
      options: {
        config: {
          host: process.env.MEILISEARCH_HOST ?? '',
          apiKey: process.env.MEILISEARCH_API_KEY ?? '',
        },
        settings: {
          // The key is used as the index name in Meilisearch
          products: {
            // Required: Index type
            type: 'products',
            // Optional: Whether the index is enabled. When disabled:
            // - Index won't be created or updated
            // - Documents won't be added or removed
            // - Index won't be included in searches
            // - All operations will be silently skipped
            enabled: true,
            // Optional: Specify which fields to include in the index
            // If not specified, all fields will be included
            fields: ['id', 'title', 'description', 'handle', 'variant_sku', 'thumbnail'],
            indexSettings: {
              searchableAttributes: ['title', 'description', 'variant_sku'],
              displayedAttributes: ['id', 'handle', 'title', 'description', 'variant_sku', 'thumbnail'],
              filterableAttributes: ['id', 'handle'],
            },
            primaryKey: 'id',
            // Create your own transformer
            /*transformer: (product) => ({
              id: product.id,
              // other attributes...
            }),*/
          },
        },
        i18n: {
          // Choose one of the following strategies:

          // 1. Separate index per language
          // strategy: 'separate-index',
          // languages: ['en', 'fr', 'de'],
          // defaultLanguage: 'en',

          // 2. Language-specific fields with suffix
          strategy: 'field-suffix',
          languages: ['en', 'fr', 'de'],
          defaultLanguage: 'en',
          translatableFields: ['title', 'description'],
        },
      } satisfies MeilisearchPluginOptions,
    },
  ],
})
```

### ⚠️ Worker Mode Considerations

> **Important:** Product events and background tasks will **not work** if your Medusa instance is running in `server` mode, because the server instance does **not** process subscribers or background jobs.

Depending on your setup:

- **Monolithic architecture** (only one backend instance):  
  Ensure you **do not set** the `MEDUSA_WORKER_MODE` or `WORKER_MODE` environment variable. By default, Medusa will use `shared` mode, which supports both background processing and serving HTTP requests from the same instance.

- **Split architecture** (separate server and worker instances):  
  Follow the [official Medusa documentation on worker mode](https://docs.medusajs.com/learn/production/worker-mode#content).  
  In this case, you **must add this plugin in the worker instance**, as the server instance does not handle event subscribers or background tasks.


## i18n Configuration

The plugin supports two main strategies for handling translations, with flexible configuration options for each.

### Basic Configuration

```typescript
{
  i18n: {
    // Choose strategy: 'separate-index' or 'field-suffix'
    strategy: 'field-suffix',
    // List of supported languages
    languages: ['en', 'fr', 'de'],
    // Default language to fall back to
    defaultLanguage: 'en',
    // Optional: List of translatable fields
    translatableFields: ['title', 'description', 'handle']
  }
}
```

### Advanced Field Configuration

You can provide detailed configuration for each translatable field:

```typescript
{
  i18n: {
    strategy: 'field-suffix',
    languages: ['en', 'fr', 'de'],
    defaultLanguage: 'en',
    translatableFields: [
      // Simple field name
      'title',

      // Field with different target name
      {
        source: 'description',
        target: 'content'  // Will be indexed as content_en, content_fr, etc.
      },

      // Field with transformation
      {
        source: 'handle',
        transform: (value) => value.toLowerCase().replace(/\s+/g, '-')
      }
    ]
  }
}
```

### Custom Translation Transformer

The plugin provides a flexible way to transform your products with custom translations. Instead of relying on specific storage formats, you can provide translations directly to the transformer:

```typescript
import { transformProduct } from '@rokmohar/medusa-plugin-meilisearch'

const getProductTranslations = async (productId: string) => {
  // Example: fetch from your translation service/database
  return {
    title: [
      { language_code: 'en', value: 'Blue T-Shirt' },
      { language_code: 'fr', value: 'T-Shirt Bleu' },
    ],
    description: [
      { language_code: 'en', value: 'A comfortable blue t-shirt' },
      { language_code: 'fr', value: 'Un t-shirt bleu confortable' },
    ],
  }
}

// Example usage in your custom transformer
const customTransformer = async (product, options) => {
  const translations = await getProductTranslations(product.id)

  return transformProduct(product, {
    ...options,
    translations,
  })
}
```

## i18n Strategies

### 1. Separate Index per Language

This strategy creates a separate MeiliSearch index for each language. For example, if your base index is named "products", it will create:

- products_en
- products_fr
- products_de

Benefits:

- Better performance for language-specific searches
- Language-specific settings and ranking rules
- Cleaner index structure

### 2. Language-specific Fields with Suffix

This strategy adds language suffixes to translatable fields in the same index. For example:

- title_en, title_fr, title_de
- description_en, description_fr, description_de

Benefits:

- Single index to maintain
- Ability to search across all languages at once
- Smaller storage requirements

## API Endpoints

### Search for Hits

```http
GET /store/meilisearch/hits
```

Query Parameters:

- `query`: Search query string
- `limit`: (Optional) Limit results from search
- `offset`: (Optional) Offset results from search
- `language`: (Optional) Language code

Examples:

```http
GET /store/meilisearch/hits?query=shirt&language=fr
```

## Auto-detection of Translatable Fields

If no translatable fields are specified and using the field-suffix strategy, the plugin will automatically detect string fields as translatable. You can override this by explicitly specifying the fields:

```typescript
{
  i18n: {
    strategy: 'field-suffix',
    languages: ['en', 'fr'],
    defaultLanguage: 'en',
    // Only these fields will be translatable
    translatableFields: ['title', 'description']
  }
}
```

## ENV variables

Add the environment variables to your `.env` and `.env.template` file:

```env
# ... others vars
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=
```

If you want to use with the `docker-compose` from this README, use the following values:

```env
# ... others vars
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=ms
```

## docker-compose

You can add the following configuration for Meilisearch to your `docker-compose.yml`:

```yml
services:
  # ... other services

  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - '7700:7700'
    volumes:
      - ~/data.ms:/data.ms
    environment:
      - MEILI_MASTER_KEY=ms
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:7700']
      interval: 10s
      timeout: 5s
      retries: 5
```

## AI-Powered Semantic Search

This plugin supports AI-powered semantic search using vector embeddings. See [README-Semantic-Search.md](README-Semantic-Search.md) for detailed configuration and usage instructions.

## Add search to Medusa NextJS starter

You can find instructions on how to add search to a Medusa NextJS starter inside the [nextjs](nextjs) folder.

## Contributing

Feel free to open issues and pull requests!
