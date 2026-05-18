# MedusaJS v2 MeiliSearch Plugin with i18n Support

This plugin integrates MeiliSearch with your Medusa e-commerce store and adds support for internationalization (i18n) of your product catalog.

## Features

- Full-text search for your Medusa store
- Real-time indexing
- Typo-tolerance
- Faceted search
- Support for both products and categories
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

## Minimum Compatibility

| Plugin version | Medusa version |
| -------------- | -------------- |
| `^1.4.1`       | `^2.15.2`      |
| `^1.3.7`       | `^2.13.4`      |
| `^1.0.0`       | `^2.4.0`       |

> **Note:** This plugin is only compatible with MedusaJS v2. For MedusaJS v1 / v2.3.x and older, use the [legacy version](https://github.com/rokmohar/medusa-plugin-meilisearch/tree/v0.2.1).

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
          categories: {
            // Required: Index type
            type: 'categories',
            // Optional: Whether the index is enabled
            enabled: true,
            // Optional: Specify which fields to include in the index
            // If not specified, all fields will be included
            fields: ['id', 'name', 'description', 'handle', 'is_active', 'parent_id'],
            indexSettings: {
              searchableAttributes: ['name', 'description'],
              displayedAttributes: ['id', 'name', 'description', 'handle', 'is_active', 'parent_id'],
              filterableAttributes: ['id', 'handle', 'is_active', 'parent_id'],
            },
            primaryKey: 'id',
            // Create your own transformer
            /*transformer: (category) => ({
              id: category.id,
              name: category.name,
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

The plugin provides a flexible way to transform your products with custom translations. Translations are passed directly to the default transformer via `TransformOptions`:

```typescript
{
  settings: {
    products: {
      type: 'products',
      // ... other config
      transformer: async (product, defaultTransformer, options) => {
        const translations = {
          title: [
            { language_code: 'en', value: 'Blue T-Shirt' },
            { language_code: 'fr', value: 'T-Shirt Bleu' },
          ],
          description: [
            { language_code: 'en', value: 'A comfortable blue t-shirt' },
            { language_code: 'fr', value: 'Un t-shirt bleu confortable' },
          ],
        }

        return defaultTransformer(product, {
          ...options,
          translations,
          includeAllTranslations: true,
        })
      },
    }
  }
}
```

Pass `includeAllTranslations: true` to emit all language suffixes (e.g. `title_en`, `title_fr`). Without it only the current language suffix is written.

### Integration with Medusa Native Translations

The recommended approach for production is to use the [Medusa Translation module](https://docs.medusajs.com/resources/commerce-modules/product/translations), which is built into Medusa v2.

**1. Enable the translation feature flag and module in `medusa-config.ts`:**

```typescript
module.exports = defineConfig({
  featureFlags: {
    translation: true,
  },
  // ... other config
  modules: [
    // ... other modules
    {
      resolve: '@medusajs/medusa/translation',
    },
  ],
})
```

**2. Create a translations utility (`src/utils/translations.ts`):**

```typescript
import { ContainerRegistrationKeys } from '@medusajs/utils'
import type { MedusaContainer } from '@medusajs/framework'
import { TranslationMap } from '@rokmohar/medusa-plugin-meilisearch'

// Maps Medusa locale codes (e.g. 'sl-SI') to index field suffixes (e.g. 'sl')
export const LOCALE_MAP: Record<string, string> = {
  'sl-SI': 'sl',
  'en-US': 'en',
  // add more as needed
}

export const getTranslations = async (
  id: string,
  langs: string[],
  container: MedusaContainer,
): Promise<TranslationMap> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: rows } = await query.graph({
    entity: 'translation',
    fields: ['reference_id', 'locale_code', 'translations'],
    filters: { reference_id: id, locale_code: langs },
  })

  const result: TranslationMap = {}

  for (const row of rows) {
    const langCode = LOCALE_MAP[row.locale_code] ?? row.locale_code

    for (const [field, value] of Object.entries(row.translations as Record<string, string>)) {
      if (!result[field]) {
        result[field] = []
      }
      result[field].push({ language_code: langCode, value })
    }
  }

  return result
}
```

**3. Use in your transformer:**

The transformer receives `options.container` — the real `MedusaContainer` forwarded by workflow steps. It is `undefined` when no container is available (e.g. during a manual index rebuild without a workflow context), so always guard with a fallback:

```typescript
import { getTranslations, LOCALE_MAP } from './src/utils/translations'

{
  settings: {
    products: {
      type: 'products',
      indexSettings: {
        searchableAttributes: ['title', 'title_sl', 'title_en'],
        displayedAttributes: ['id', 'handle', 'title', 'title_sl', 'title_en', 'thumbnail'],
        filterableAttributes: ['id'],
      },
      transformer: async (product, defaultTransformer, options) => {
        if (!options?.container) {
          // No container available — index without translations
          return defaultTransformer(product, options)
        }

        const raw = await getTranslations(product.id, ['sl-SI', 'en-US'], options.container)

        // Remap locale codes to match index field suffixes
        const translations = Object.fromEntries(
          Object.entries(raw).map(([field, values]) => [
            field,
            values.map((t) => ({
              language_code: LOCALE_MAP[t.language_code] ?? t.language_code,
              value: t.value,
            })),
          ]),
        )

        return defaultTransformer(product, {
          ...options,
          translations,
          includeAllTranslations: true,
        })
      },
    }
  }
}
```

> **How `container` reaches the transformer:** Medusa plugin modules receive the awilix cradle proxy at construction time, not the real `MedusaContainer` — so the service cannot self-supply it. Workflow steps (triggered by product/category events) have the real container from their `createStep` context and forward it via `addDocuments(indexName, documents, type, { container })`. The transformer then resolves services (e.g. `QUERY`) from it.

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

## Custom Translatable Fields

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

## Product API Endpoints

### Search for Product Hits

```http
GET /store/meilisearch/products-hits
```

Query Parameters:

- `query`: Search query string
- `limit`: (Optional) Limit results from search
- `offset`: (Optional) Offset results from search
- `language`: (Optional) Language code
- `semanticSearch` - Enable AI-powered semantic search (boolean)
- `semanticRatio` - Semantic vs keyword search ratio (0-1)

### Search for Products

```http
GET /store/meilisearch/products
```

Query Parameters:

- `fields` - MedusaJS fields expression
- `limit`: (Optional) Limit results from search
- `offset`: (Optional) Offset results from search
- `region_id`: (Optional, but required for `calculated_price`) Current region ID
- `currency_code`: (Optional, but required for `calculated_price`) Current currency code
- `query`: Search query string
- `language`: (Optional) Language code
- `semanticSearch` - Enable AI-powered semantic search (boolean)
- `semanticRatio` - Semantic vs keyword search ratio (0-1)

## Category Support

This plugin provides full support for MedusaJS v2 categories, including:

- Real-time indexing of category changes
- i18n support for category names and descriptions
- Hierarchical category structure support with parent-child relationships
- Custom category field transformations

### Category Configuration Example

```typescript
{
  settings: {
    categories: {
      type: 'categories',
      enabled: true,
      fields: ['id', 'name', 'description', 'handle', 'is_active', 'parent_id'],
      indexSettings: {
        searchableAttributes: ['name', 'description'],
        displayedAttributes: ['id', 'name', 'description', 'handle', 'is_active', 'parent_id'],
        filterableAttributes: ['id', 'handle', 'is_active', 'parent_id'],
      },
      primaryKey: 'id',
    },
  },
  i18n: {
    strategy: 'field-suffix',
    languages: ['en', 'fr', 'de'],
    defaultLanguage: 'en',
    translatableFields: ['name', 'description'], // Category-specific translatable fields
  },
}
```

### Category API Endpoints

### Search for Category Hits

```http
GET /store/meilisearch/categories-hits
```

Query Parameters:

- `query`: Search query string
- `limit`: (Optional) Limit results from search
- `offset`: (Optional) Offset results from search
- `language`: (Optional) Language code
- `semanticSearch` - Enable AI-powered semantic search (boolean)
- `semanticRatio` - Semantic vs keyword search ratio (0-1)

### Search for Categories

```http
GET /store/meilisearch/categories
```

Query Parameters:

- `fields` - MedusaJS fields expression
- `limit`: (Optional) Limit results from search
- `offset`: (Optional) Offset results from search
- `query`: Search query string
- `language`: (Optional) Language code
- `semanticSearch` - Enable AI-powered semantic search (boolean)
- `semanticRatio` - Semantic vs keyword search ratio (0-1)

## AI-Powered Semantic Search

This plugin supports AI-powered semantic search using vector embeddings. See [docs/semantic-search.md](docs/semantic-search.md) for detailed configuration and usage instructions.

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

## Add search to Medusa NextJS starter

You can find instructions on how to add search to a Medusa NextJS starter inside the [nextjs](nextjs) folder.

## FAQ

- [How do I include product categories and tags in my search index?](docs/faq-product-categories-and-tags.md)
- [How do I include product variant prices (min_price, max_price) in my search index?](docs/faq-product-variant-prices.md)
- [How do I include prices in the search response from the search endpoint?](docs/faq-product-search-prices.md)

## Contributing

Feel free to open issues and pull requests!
