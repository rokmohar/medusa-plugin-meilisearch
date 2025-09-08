import { MedusaContainer } from '@medusajs/framework'
import { ProductStatus } from '@medusajs/utils'
import { syncProductsWorkflow } from '../workflows/sync-products'

export interface ProductIndexingOptions {
  pageSize?: number
  continueOnError?: boolean
}

export interface ProductIndexingResult {
  totalProducts: number
  totalPages: number
  duration: number
  errors: string[]
}

export async function indexProducts(
  container: MedusaContainer,
  options: ProductIndexingOptions = {},
): Promise<ProductIndexingResult> {
  const logger = container.resolve('logger')
  const startTime = Date.now()
  const { pageSize = 100, continueOnError = true } = options
  const errors: string[] = []

  logger.info('Starting product indexing...')

  // 查询产品总数
  const query = container.resolve('query')
  const { metadata } = await query.graph({
    entity: 'product',
    fields: ['id'],
    filters: {
      status: ProductStatus.PUBLISHED,
    },
    pagination: {
      skip: 0,
    },
  })

  // 计算总页数
  const totalProducts = metadata?.count ?? 0
  const totalPages = Math.ceil(totalProducts / pageSize)
  logger.info(`Total pages: ${totalPages} --- Total products: ${totalProducts}`)

  // 分批同步产品
  for (let i = 0; i < totalPages; i++) {
    logger.info(`Syncing products page ${i + 1} of ${totalPages}`)
    try {
      const { result: products } = await syncProductsWorkflow(container).run({
        input: {
          offset: i * pageSize,
          limit: pageSize,
        },
      })

      logger.info(`Page ${i + 1} successfully indexed ${products.products.length} products`)

      // 验证返回的产品数量是否符合预期
      if (products.products.length < pageSize && i < totalPages - 1) {
        logger.warn(`Expected ${pageSize} products, but received ${products.products.length} on page ${i + 1}`)
      }
    } catch (error) {
      const errorMessage = `Failed to sync products on page ${i + 1}: ${error.message}`
      logger.error(errorMessage)
      errors.push(errorMessage)

      if (!continueOnError) {
        throw error
      }
    }
  }

  const duration = (Date.now() - startTime) / 1000
  logger.info(`Product indexing completed in ${duration} seconds`)

  return {
    totalProducts,
    totalPages,
    duration,
    errors,
  }
}
