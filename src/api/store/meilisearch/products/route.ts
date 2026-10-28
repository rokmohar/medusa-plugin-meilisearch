import { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework'
import { ProductDTO } from '@medusajs/types'
import {
  ContainerRegistrationKeys,
  QueryContext,
  isPresent,
  prepareInventoryQuantityFields,
  transformAndValidateSalesChannelIds,
  wrapVariantsWithInventoryQuantityForSalesChannel,
  wrapProductsWithTaxPrices,
} from '../../../utils/medusa'
import { restrictIds, searchDocumentIds } from '../../../utils/search'
import '../../../types'

export interface ProductsResponse {
  products: ProductDTO[]
  count: number
  limit?: number
  offset?: number
}

export async function GET(req: MedusaStoreRequest, res: MedusaResponse<ProductsResponse>) {
  const meili = req.meiliParams ?? { semanticSearch: false, semanticRatio: 0.5 }
  const isSearch = Boolean(meili.query ?? meili.semanticSearch)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { fields, pagination } = req.queryConfig
  const filters = req.filterableFields
  const limit = pagination.take
  const offset = pagination.skip

  // Same as native: drop the virtual field and fetch what the inventory wrapper needs instead.
  const { fields: graphFields, withInventoryQuantity } = prepareInventoryQuantityFields(fields, {
    relation: 'variants',
  })

  let productIds: string[] = []
  let totalCount = 0
  let graphPagination = pagination

  if (isSearch) {
    const result = await searchDocumentIds(
      req,
      'product',
      {
        query: meili.query,
        index: meili.index,
        limit,
        offset,
        language: meili.language,
        semanticSearch: meili.semanticSearch,
        semanticRatio: meili.semanticRatio,
        embedder: meili.embedder,
        filter: meili.filter,
      },
      // The requested `sales_channel_id` subset, or every channel of the publishable key.
      { salesChannelIds: transformAndValidateSalesChannelIds(req) },
    )

    productIds = result.ids
    totalCount = result.count

    if (!productIds.length) {
      res.json({ products: [], count: 0, limit, offset })

      return
    }

    filters.id = { $in: restrictIds(productIds, filters.id) }
    graphPagination = { ...pagination, skip: 0, take: productIds.length }
  }

  const context: Record<string, unknown> = {}

  if (isPresent(req.pricingContext)) {
    context.variants = { calculated_price: QueryContext({ ...req.pricingContext }) }
  }

  const { data: products = [], metadata } = await query.graph(
    {
      entity: 'product',
      fields: graphFields,
      filters,
      pagination: graphPagination,
      context,
    },
    {
      cache: { enable: true },
      locale: req.locale,
    },
  )

  if (withInventoryQuantity) {
    await wrapVariantsWithInventoryQuantityForSalesChannel(
      req,
      products
        .map((product) => {
          return product.variants
        })
        .flat(1),
    )
  }

  await wrapProductsWithTaxPrices(req, products)

  let orderedProducts = products

  if (isSearch) {
    orderedProducts = [...products].sort((a, b) => {
      return productIds.indexOf(a.id) - productIds.indexOf(b.id)
    })
  }

  res.json({
    products: orderedProducts,
    count: isSearch ? totalCount : (metadata?.count ?? products.length),
    offset: isSearch ? offset : (metadata?.skip ?? offset),
    limit: isSearch ? limit : (metadata?.take ?? limit),
  })
}
