import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { SearchUtils } from '@medusajs/utils'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'
import z from 'zod'

// Schema that combines standard MedusaJS product query params with meilisearch params
export const StoreProductsSchema = z.object({
  // Standard MedusaJS v2 product query parameters
  fields: z.string().optional(),
  limit: z.coerce.number().default(50).optional(),
  offset: z.coerce.number().default(0).optional(),
  order: z.string().optional(),
  id: z.union([z.string(), z.array(z.string())]).optional(),
  handle: z.union([z.string(), z.array(z.string())]).optional(),
  title: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  collection_id: z.union([z.string(), z.array(z.string())]).optional(),
  category_id: z.union([z.string(), z.array(z.string())]).optional(),
  type_id: z.union([z.string(), z.array(z.string())]).optional(),
  tag_id: z.union([z.string(), z.array(z.string())]).optional(),
  region_id: z.string().optional(),
  currency_code: z.string().optional(),
  // Meilisearch-specific parameters
  query: z.string().optional(),
  language: z.string().optional(),
  semanticSearch: z.coerce.boolean().default(false).optional(),
  semanticRatio: z.coerce.number().min(0).max(1).default(0.5).optional(),
})

export type StoreProductsParams = z.infer<typeof StoreProductsSchema>

export async function GET(req: MedusaRequest<any, StoreProductsParams>, res: MedusaResponse) {
  const {
    // Standard params
    fields,
    limit = 50,
    offset = 0,
    order,
    id,
    handle,
    title,
    status,
    collection_id,
    category_id,
    type_id,
    tag_id,
    //region_id,
    //currency_code,
    // Meilisearch params
    query,
    language,
    semanticSearch = false,
    semanticRatio = 0.5,
  } = req.validatedQuery

  const queryService = req.scope.resolve('query')
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  // Build standard Medusa filters
  const standardFilters: Record<string, unknown> = {
    status: status || 'published',
  }

  if (id) {
    standardFilters.id = Array.isArray(id) ? { $in: id } : id
  }
  if (handle) {
    standardFilters.handle = Array.isArray(handle) ? { $in: handle } : handle
  }
  if (title) {
    standardFilters.title = { $ilike: `%${title}%` }
  }
  if (collection_id) {
    standardFilters.collection_id = Array.isArray(collection_id) ? { $in: collection_id } : collection_id
  }
  if (category_id) {
    standardFilters.categories = { id: Array.isArray(category_id) ? { $in: category_id } : category_id }
  }
  if (type_id) {
    standardFilters.type_id = Array.isArray(type_id) ? { $in: type_id } : type_id
  }
  if (tag_id) {
    standardFilters.tags = { id: Array.isArray(tag_id) ? { $in: tag_id } : tag_id }
  }

  let productIds: string[] = []
  let totalCount = 0

  // If meilisearch query parameters are provided, use meilisearch for filtering
  if (query || semanticSearch) {
    const indexes = await meilisearchService.getIndexesByType('products')
    const results = await Promise.all(
      indexes.map(async (indexKey) => {
        return await meilisearchService.search(indexKey, query || '', {
          language,
          paginationOptions: {
            limit,
            offset,
          },
          semanticSearch,
          semanticRatio,
        })
      }),
    )

    // Merge results from all indexes
    const mergedResults = results.reduce(
      (acc, result) => {
        return {
          hits: [...acc.hits, ...result.hits],
          estimatedTotalHits: (acc.estimatedTotalHits || 0) + (result.estimatedTotalHits || 0),
          processingTimeMs: Math.max(acc.processingTimeMs, result.processingTimeMs),
          query: result.query,
        }
      },
      { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query: query || '' },
    )

    productIds = mergedResults.hits.map((hit: any) => hit.id)
    totalCount = mergedResults.estimatedTotalHits

    // If we have meilisearch results, filter by those IDs
    if (productIds.length > 0) {
      standardFilters.id = { $in: productIds }
    } else {
      // No results from meilisearch, return empty response
      res.json({
        products: [],
        count: 0,
        offset,
        limit,
      })
      return
    }
  }

  // Get product fields for the query
  const productFields = await meilisearchService.getFieldsForType(SearchUtils.indexTypes.PRODUCTS)

  // Build field selection
  const selectedFields = fields ? fields.split(',') : productFields

  // Fetch products using the standard Medusa query service
  const { data: products, metadata } = await queryService.graph({
    entity: 'product',
    fields: selectedFields,
    pagination: {
      take: limit,
      skip: offset,
    },
    filters: standardFilters,
    ...(order && {
      order: { [order.startsWith('-') ? order.slice(1) : order]: order.startsWith('-') ? 'DESC' : 'ASC' },
    }),
  })

  // If we used meilisearch, preserve the order from the search results
  let orderedProducts = products

  if (query || semanticSearch) {
    const productIdOrder = productIds
    orderedProducts = products.sort((a, b) => {
      const aIndex = productIdOrder.indexOf(a.id)
      const bIndex = productIdOrder.indexOf(b.id)
      return aIndex - bIndex
    })
  }

  res.json({
    products: orderedProducts,
    count: query || semanticSearch ? totalCount : metadata?.count || products.length,
    offset,
    limit,
  })
}
