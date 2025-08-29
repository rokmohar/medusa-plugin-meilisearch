# AI-Powered Semantic Search

The MeiliSearch plugin now supports AI-powered semantic search using vector embeddings. This enables more intelligent search results based on meaning rather than just keywords.

## Features

- **Native MeiliSearch Vector Search**: Uses MeiliSearch's built-in embedder support (requires MeiliSearch v1.5+)
- **Hybrid Search**: Combines traditional keyword search with semantic vector search
- **Multiple Embedding Providers**: Support for both Ollama (local) and OpenAI (cloud)
- **Configurable Semantic Ratio**: Control the balance between keyword and semantic search (0.0 = pure keyword, 1.0 = pure semantic)
- **Automatic Embedding Generation**: MeiliSearch generates embeddings automatically using configured embedders
- **Admin Panel Controls**: Manage and test semantic search from the admin interface

> **Note**: This implementation uses MeiliSearch's native embedder functionality. Make sure you're using MeiliSearch v1.5 or later for full vector search support.

## Use Case 1: Local Ollama with nomic-embed-text

```js
module.exports = defineConfig({
  plugins: [
    {
      resolve: '@rokmohar/medusa-plugin-meilisearch',
      options: {
        config: {
          host: process.env.MEILISEARCH_HOST ?? 'http://127.0.0.1:7700',
          apiKey: process.env.MEILISEARCH_API_KEY ?? 'ms',
        },
        settings: {
          products: {
            type: 'products',
            enabled: true,
            fields: ['id', 'title', 'description', 'handle', 'variant_sku', 'thumbnail'],
            indexSettings: {
              searchableAttributes: ['title', 'description', 'variant_sku'],
              displayedAttributes: ['id', 'handle', 'title', 'description', 'variant_sku', 'thumbnail'],
              filterableAttributes: ['id', 'handle'],
            },
          },
        },
        vectorSearch: {
          enabled: true,
          embedding: {
            provider: 'ollama',
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text',
          },
          embeddingFields: ['title', 'description'],
          semanticRatio: 0.5, // Balanced hybrid search
          dimensions: 768, // nomic-embed-text dimension
        },
      },
    },
  ],
})
```

## Use Case 2: Local Ollama with Ngrok (Simulating Live Version)

```js
module.exports = defineConfig({
  plugins: [
    {
      resolve: '@rokmohar/medusa-plugin-meilisearch',
      options: {
        config: {
          host: process.env.MEILISEARCH_HOST ?? 'http://127.0.0.1:7700',
          apiKey: process.env.MEILISEARCH_API_KEY ?? 'ms',
        },
        settings: {
          products: {
            type: 'products',
            enabled: true,
            fields: ['id', 'title', 'description', 'handle', 'variant_sku', 'thumbnail'],
            indexSettings: {
              searchableAttributes: ['title', 'description', 'variant_sku'],
              displayedAttributes: ['id', 'handle', 'title', 'description', 'variant_sku', 'thumbnail'],
              filterableAttributes: ['id', 'handle'],
            },
          },
        },
        vectorSearch: {
          enabled: true,
          embedding: {
            provider: 'ollama',
            baseUrl: 'http://localhost:11434', // Local fallback
            model: 'nomic-embed-text',
            ngrokUrl: process.env.OLLAMA_NGROK_URL, // e.g., 'https://abc123.ngrok.io'
          },
          embeddingFields: ['title', 'description'],
          semanticRatio: 0.7, // More semantic-focused search
          dimensions: 768,
        },
      },
    },
  ],
})
```

## Use Case 3: Remote OpenAI text-embedding-3-small

```js
module.exports = defineConfig({
  plugins: [
    {
      resolve: '@rokmohar/medusa-plugin-meilisearch',
      options: {
        config: {
          host: process.env.MEILISEARCH_HOST ?? 'http://127.0.0.1:7700',
          apiKey: process.env.MEILISEARCH_API_KEY ?? 'ms',
        },
        settings: {
          products: {
            type: 'products',
            enabled: true,
            fields: ['id', 'title', 'description', 'handle', 'variant_sku', 'thumbnail'],
            indexSettings: {
              searchableAttributes: ['title', 'description', 'variant_sku'],
              displayedAttributes: ['id', 'handle', 'title', 'description', 'variant_sku', 'thumbnail'],
              filterableAttributes: ['id', 'handle'],
            },
          },
        },
        vectorSearch: {
          enabled: true,
          embedding: {
            provider: 'openai',
            apiKey: process.env.OPENAI_API_KEY,
            model: 'text-embedding-3-small',
          },
          embeddingFields: ['title', 'description'],
          semanticRatio: 1.0, // Pure semantic search
          dimensions: 1536, // text-embedding-3-small dimension
        },
      },
    },
  ],
})
```

## Required Environment Variables

### For Use Case 1 & 2 (Ollama):
```env
# Standard MeiliSearch
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=ms

# For Use Case 2 only - Ngrok tunnel URL
OLLAMA_NGROK_URL=https://your-ngrok-url.ngrok.io
```

### For Use Case 3 (OpenAI):
```env
# Standard MeiliSearch
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=ms

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key
```

## Ollama Setup (Use Cases 1 & 2)

1. **Install Ollama**: Follow instructions at [ollama.com](https://ollama.com)

2. **Pull the embedding model**:
   ```bash
   ollama pull nomic-embed-text
   ```

3. **Start Ollama server** (usually runs on `http://localhost:11434`):
   ```bash
   ollama serve
   ```

4. **For Use Case 2 - Setup Ngrok** (optional):
   ```bash
   # Install ngrok and expose Ollama
   ngrok http 11434
   
   # Use the provided HTTPS URL in your configuration
   ```

## Using Semantic Search

### API Endpoint Parameters

The `/store/meilisearch/hits` endpoint now supports these additional parameters:

- `semanticSearch` (boolean): Enable semantic search
- `semanticRatio` (number, 0-1): Balance between keyword and semantic search

### Examples

**Pure keyword search** (traditional):
```http
GET /store/meilisearch/hits?query=blue shirt&semanticSearch=false
```

**Balanced hybrid search**:
```http
GET /store/meilisearch/hits?query=blue shirt&semanticSearch=true&semanticRatio=0.5
```

**Pure semantic search**:
```http
GET /store/meilisearch/hits?query=comfortable clothing&semanticSearch=true&semanticRatio=1.0
```

### JavaScript Example

```javascript
// Fetch with semantic search
const response = await fetch('/store/meilisearch/hits?' + new URLSearchParams({
  query: 'comfortable summer clothing',
  semanticSearch: 'true',
  semanticRatio: '0.7',
  language: 'en',
  limit: '10'
}))

const results = await response.json()
console.log('Found:', results.hits.length, 'products')
console.log('Hybrid search used:', results.hybridSearch)
console.log('Semantic ratio:', results.semanticRatio)
```

## Admin Panel

Access the MeiliSearch admin panel at `/admin/settings/meilisearch` to:

- View vector search configuration status
- Test semantic search with different ratios
- Manually trigger data synchronization (including embedding generation)
- Monitor search performance

## How It Works

This implementation leverages MeiliSearch's **native embedder functionality** rather than managing embeddings manually:

1. **Embedder Configuration**: Plugin automatically configures MeiliSearch embedders based on your settings
2. **Automatic Embedding**: MeiliSearch generates embeddings for your documents using the configured model
3. **Native Hybrid Search**: Uses MeiliSearch's built-in `hybrid` search parameter for optimal performance
4. **Document Templates**: Automatically creates document templates to combine your specified embedding fields

### Key Differences from Manual Approaches

- ✅ **No manual embedding generation**: MeiliSearch handles everything
- ✅ **Better performance**: Native implementation is optimized
- ✅ **Automatic updates**: Embeddings stay in sync with document changes
- ✅ **Less complexity**: No need to manage vector storage separately

## Performance Considerations

- **Ollama (Local)**: Faster for development, no API costs, requires local compute resources
- **OpenAI (Cloud)**: Faster embedding generation, API costs apply, better for production  
- **MeiliSearch Version**: Requires MeiliSearch v1.5+ for full vector search support
- **Embedding Generation**: Happens automatically when documents are indexed
- **Search Performance**: Native hybrid search is optimized and faster than manual implementations

## Troubleshooting

### Common Issues

1. **MeiliSearch Version**: Ensure you're using MeiliSearch v1.5+ for vector search support
2. **Ollama Connection Failed**: Make sure Ollama is running on the correct port (default: 11434)
3. **Vector Search Not Working**: Check that `vectorSearch.enabled` is set to `true` and embedders are properly configured
4. **Ngrok URL Issues**: Ensure the ngrok tunnel is active and the URL is correctly set in environment variables
5. **Embedder Configuration Failed**: Check MeiliSearch logs for embedder setup errors

### Verify Embedder Configuration

You can check if embedders are properly configured by accessing your MeiliSearch instance directly:

```bash
# Check embedders for an index
curl "http://localhost:7700/indexes/products/settings/embedders" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Should return something like:
{
  "default": {
    "source": "ollama",
    "model": "nomic-embed-text",
    "url": "http://localhost:11434/api/embeddings",
    "dimensions": 768
  }
}
```

### Debug Vector Search

Test vector search directly through MeiliSearch API:

```bash
# Test hybrid search
curl -X POST "http://localhost:7700/indexes/products/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "q": "comfortable shirt",
    "hybrid": {
      "embedder": "default",
      "semanticRatio": 0.8
    }
  }'
```

## Advanced Configuration

### Custom Embedding Fields

You can customize which fields are used for embedding generation:

```js
vectorSearch: {
  enabled: true,
  embedding: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'nomic-embed-text',
  },
  embeddingFields: ['title', 'description', 'tags', 'category'], // Custom fields
  semanticRatio: 0.6,
}
```

### Custom Transformer with Embeddings

You can provide a custom transformer that works with vector embeddings:

```js
settings: {
  products: {
    type: 'products',
    enabled: true,
    transformer: async (product, defaultTransformer, options) => {
      // Use default transformer first
      const transformed = await defaultTransformer(product, options)
      
      // Add custom fields for embedding
      return {
        ...transformed,
        searchText: `${product.title} ${product.description} ${product.tags?.join(' ') || ''}`,
        category_path: product.categories?.map(c => c.name).join(' > ') || '',
      }
    },
  },
}
```

## Migration from Basic Search

If you're upgrading from basic keyword search to semantic search:

1. **Backup your current index**: Export your existing MeiliSearch data
2. **Add vector configuration**: Update your plugin configuration with `vectorSearch` options
3. **Re-sync data**: Trigger a full data sync to generate embeddings
4. **Test gradually**: Start with a low `semanticRatio` (0.2-0.3) and increase based on results
5. **Monitor performance**: Check search response times and adjust configuration as needed

## API Reference

### Vector Search Configuration

```typescript
interface VectorSearchConfig {
  enabled: boolean
  embedding: EmbeddingConfig
  embeddingFields?: string[]
  semanticRatio?: number
  dimensions?: number
}

interface EmbeddingConfig {
  provider: 'ollama' | 'openai'
  // Provider-specific options...
}
```

### Search Response

When using semantic search, the response includes additional metadata:

```typescript
interface SearchResponse {
  hits: Array<{
    // ... product data
    _combinedScore?: number  // Hybrid search score
    _keywordScore?: number   // Keyword search score
    _vectorScore?: number    // Vector similarity score
  }>
  hybridSearch?: boolean     // True if hybrid search was used
  semanticRatio?: number     // The semantic ratio used
  // ... other standard MeiliSearch response fields
}
```
