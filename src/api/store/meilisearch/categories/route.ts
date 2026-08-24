import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ProductCategoryDTO } from '@medusajs/types'
import { ContainerRegistrationKeys } from '../../../utils/medusa'
import { searchDocumentIds } from '../../../utils/search'
import '../../../types'

export interface CategoriesResponse {
  categories: ProductCategoryDTO[]
  count: number
  limit?: number
  offset?: number
}

export async function GET(req: MedusaRequest, res: MedusaResponse<CategoriesResponse>) {
  const meili = req.meiliParams ?? { semanticSearch: false, semanticRatio: 0.5 }
  const isSearch = Boolean(meili.query ?? meili.semanticSearch)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { fields, pagination } = req.queryConfig
  const filters = req.filterableFields
  const limit = pagination.take
  const offset = pagination.skip

  let categoryIds: string[] = []
  let totalCount = 0
  let graphPagination = pagination

  if (isSearch) {
    const result = await searchDocumentIds(req, 'product_category', {
      query: meili.query,
      index: meili.index,
      limit,
      offset,
      language: meili.language,
      semanticSearch: meili.semanticSearch,
      semanticRatio: meili.semanticRatio,
      embedder: meili.embedder,
      filter: meili.filter,
    })

    categoryIds = result.ids
    totalCount = result.count

    if (!categoryIds.length) {
      res.json({ categories: [], count: 0, limit, offset })

      return
    }

    filters.id = { $in: categoryIds }
    graphPagination = { ...pagination, skip: 0, take: categoryIds.length }
  }

  const { data: categories = [], metadata } = await query.graph(
    {
      entity: 'product_category',
      fields,
      filters,
      pagination: graphPagination,
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
    offset: isSearch ? offset : (metadata?.skip ?? offset),
    limit: isSearch ? limit : (metadata?.take ?? limit),
  })
}
