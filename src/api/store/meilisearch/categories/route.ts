import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'
import z from 'zod'

// Schema that combines standard MedusaJS category query params with meilisearch params
export const StoreCategoriesSchema = z.object({
  // Standard MedusaJS v2 category query parameters
  fields: z.string().optional(),
  limit: z.coerce.number().default(50).optional(),
  offset: z.coerce.number().default(0).optional(),
  order: z.string().optional(),
  id: z.union([z.string(), z.array(z.string())]).optional(),
  handle: z.union([z.string(), z.array(z.string())]).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  parent_category_id: z.union([z.string(), z.array(z.string())]).optional(),
  is_active: z.coerce.boolean().optional(),
  is_internal: z.coerce.boolean().optional(),
  include_descendants_tree: z.coerce.boolean().default(false).optional(),

  // Meilisearch-specific parameters
  query: z.string().optional(),
  language: z.string().optional(),
  semanticSearch: z.coerce.boolean().default(false).optional(),
  semanticRatio: z.coerce.number().min(0).max(1).default(0.5).optional(),
})

export type StoreCategoriesParams = z.infer<typeof StoreCategoriesSchema>

export async function GET(req: MedusaRequest<any, StoreCategoriesParams>, res: MedusaResponse) {
  const {
    // Standard params
    fields,
    limit = 50,
    offset = 0,
    order,
    id,
    handle,
    name,
    description,
    parent_category_id,
    is_active,
    is_internal,
    //include_descendants_tree = false,
    // Meilisearch params
    query,
    language,
    semanticSearch = false,
    semanticRatio = 0.5,
  } = req.validatedQuery

  const queryService = req.scope.resolve('query')
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  // Build standard Medusa filters
  const standardFilters: Record<string, unknown> = {}

  if (id) {
    standardFilters.id = Array.isArray(id) ? { $in: id } : id
  }
  if (handle) {
    standardFilters.handle = Array.isArray(handle) ? { $in: handle } : handle
  }
  if (name) {
    standardFilters.name = { $ilike: `%${name}%` }
  }
  if (description) {
    standardFilters.description = { $ilike: `%${description}%` }
  }
  if (parent_category_id) {
    standardFilters.parent_category_id = Array.isArray(parent_category_id)
      ? { $in: parent_category_id }
      : parent_category_id
  }
  if (is_active !== undefined) {
    standardFilters.is_active = is_active
  }
  if (is_internal !== undefined) {
    standardFilters.is_internal = is_internal
  }

  let categoryIds: string[] = []
  let totalCount = 0

  // If meilisearch query parameters are provided, use meilisearch for filtering
  if (query || semanticSearch) {
    const indexes = await meilisearchService.getIndexesByType('categories')
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

    categoryIds = mergedResults.hits.map((hit: any) => hit.id)
    totalCount = mergedResults.estimatedTotalHits

    // If we have meilisearch results, filter by those IDs
    if (categoryIds.length > 0) {
      standardFilters.id = { $in: categoryIds }
    } else {
      // No results from meilisearch, return empty response
      res.json({
        product_categories: [],
        count: 0,
        offset,
        limit,
      })
      return
    }
  }

  // Get category fields for the query
  const categoryFields = await meilisearchService.getFieldsForType('categories')

  // Build field selection
  const selectedFields = fields ? fields.split(',') : categoryFields

  // Fetch categories using the standard Medusa query service
  const { data: categories, metadata } = await queryService.graph({
    entity: 'product_category',
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
  let orderedCategories = categories

  if (query || semanticSearch) {
    const categoryIdOrder = categoryIds
    orderedCategories = categories.sort((a, b) => {
      const aIndex = categoryIdOrder.indexOf(a.id)
      const bIndex = categoryIdOrder.indexOf(b.id)
      return aIndex - bIndex
    })
  }

  res.json({
    product_categories: orderedCategories,
    count: query || semanticSearch ? totalCount : metadata?.count || categories.length,
    offset,
    limit,
  })
}
