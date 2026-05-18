import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ProductCategoryDTO } from '@medusajs/types'
import { Hit } from 'meilisearch'
import { MEILISEARCH_MODULE, MeiliSearchService } from '../../../../modules/meilisearch'
import { ContainerRegistrationKeys } from '../../../utils/medusa'
import '../../../types'

export interface CategoriesResponse {
  // Envelope key kept as `categories` for backwards-compat with existing plugin
  // consumers (native uses `product_categories`); query/filter/sort behaviour matches
  // native `/store/product-categories`.
  categories: ProductCategoryDTO[]
  count: number
  limit?: number
  offset?: number
}

/**
 * Behaves like the native `/store/product-categories` route. The native middleware
 * stack (see ../../../middlewares.ts) populates `req.queryConfig` / `req.filterableFields`.
 * When a Meilisearch `query`/`semanticSearch` is present, Meilisearch supplies the
 * candidate category ids + ranking; otherwise behaviour is identical to native.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse<CategoriesResponse>) {
  const meili = req.meiliParams ?? { semanticSearch: false, semanticRatio: 0.5 }
  const isSearch = Boolean(meili.query ?? meili.semanticSearch)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const meilisearchService: MeiliSearchService = req.scope.resolve(MEILISEARCH_MODULE)

  const { fields, pagination } = req.queryConfig
  const filters = req.filterableFields
  const limit = pagination.take
  const offset = pagination.skip

  let categoryIds: string[] = []
  let totalCount = 0

  if (isSearch) {
    const indexes = await meilisearchService.getIndexesByType('categories')
    const results = await Promise.all(
      indexes.map(async (indexKey) => {
        return meilisearchService.search(indexKey, meili.query ?? '', {
          language: meili.language,
          paginationOptions: { limit, offset },
          semanticSearch: meili.semanticSearch,
          semanticRatio: meili.semanticRatio,
        })
      }),
    )

    const mergedResults = results.reduce<{
      hits: Hit[]
      estimatedTotalHits: number
      processingTimeMs: number
      query: string
    }>(
      (acc, result) => {
        return {
          hits: [...acc.hits, ...result.hits],
          estimatedTotalHits: acc.estimatedTotalHits + result.estimatedTotalHits,
          processingTimeMs: Math.max(acc.processingTimeMs, result.processingTimeMs),
          query: result.query,
        }
      },
      { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query: meili.query ?? '' },
    )

    categoryIds = mergedResults.hits.map((hit) => {
      return hit.id
    })
    totalCount = mergedResults.estimatedTotalHits

    if (categoryIds.length === 0) {
      res.json({ categories: [], count: 0, limit, offset })

      return
    }

    filters.id = { $in: categoryIds }
  }

  const { data: categories = [], metadata } = await query.graph(
    {
      entity: 'product_category',
      fields,
      filters,
      pagination,
    },
    {
      locale: req.locale,
    },
  )

  let orderedCategories = categories

  if (isSearch) {
    orderedCategories = [...categories].sort((a, b) => {
      return categoryIds.indexOf(a.id) - categoryIds.indexOf(b.id)
    })
  }

  res.json({
    categories: orderedCategories,
    count: isSearch ? totalCount : (metadata?.count ?? categories.length),
    offset: metadata?.skip ?? offset,
    limit: metadata?.take ?? limit,
  })
}
