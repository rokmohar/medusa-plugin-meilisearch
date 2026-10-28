import type { MedusaRequest, MedusaResponse, MedusaNextFunction, MedusaStoreRequest } from '@medusajs/framework'
import type { SearchTypes } from '@medusajs/types'

export {
  ContainerRegistrationKeys,
  QueryContext,
  ProductStatus,
  MedusaError,
  isPresent,
  FeatureFlag,
} from '@medusajs/utils'

type MiddlewareFn = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => void | Promise<void>

interface ContextOptions {
  priceFieldPaths?: string[]
}

interface NativeHttp {
  authenticate: (actor: string, methods: string[], options?: { allowUnauthenticated?: boolean }) => MiddlewareFn
  applyDefaultFilters: (defaults: Record<string, unknown>) => MiddlewareFn
  clearFiltersByKey: (keys: string[]) => MiddlewareFn
  maybeApplyLinkFilter: (config: {
    entryPoint: string
    resourceId: string
    filterableField: string
    filterByField?: string
  }) => MiddlewareFn
}

interface NativeMiddlewares {
  filterByValidSalesChannels: () => MiddlewareFn
  transformAndValidateSalesChannelIds: (req: MedusaStoreRequest) => string[]
  prepareInventoryQuantityFields: (
    fields: string[],
    options?: { relation?: string },
  ) => { fields: string[]; withInventoryQuantity: boolean }
  normalizeDataForContext: (options?: ContextOptions) => MiddlewareFn
  setPricingContext: (options?: ContextOptions) => MiddlewareFn
  setTaxContext: (options?: ContextOptions) => MiddlewareFn
  wrapVariantsWithInventoryQuantityForSalesChannel: (req: MedusaStoreRequest, variants: unknown[]) => Promise<void>
  wrapVariantsWithTotalInventoryQuantity: (req: MedusaRequest, variants: unknown[]) => Promise<void>
}

interface NativeModulesSdk {
  MedusaModule: { getSearchIndexes?: () => SearchTypes.SearchIndexDefinition[] }
}

/* eslint-disable @typescript-eslint/no-require-imports */
const http: NativeHttp = require('@medusajs/framework/http')
// Directory subpath without a bare `exports` mapping — explicit `/index` required.
const nativeMw: NativeMiddlewares = require('@medusajs/medusa/api/utils/middlewares/index')
const productsQueryConfig = require('@medusajs/medusa/api/store/products/query-config')
const productsValidators = require('@medusajs/medusa/api/store/products/validators')
const productsHelpers = require('@medusajs/medusa/api/store/products/helpers')
const categoriesQueryConfig = require('@medusajs/medusa/api/store/product-categories/query-config')
const categoriesValidators = require('@medusajs/medusa/api/store/product-categories/validators')
const categoriesHelpers = require('@medusajs/medusa/api/store/product-categories/helpers')
const publishedProducts = require('@medusajs/medusa/api/store/utils/published-products-context')
const modulesSdk: NativeModulesSdk = require('@medusajs/framework/modules-sdk')
/* eslint-enable @typescript-eslint/no-require-imports */

export const authenticate = http.authenticate
export const applyDefaultFilters = http.applyDefaultFilters
export const clearFiltersByKey = http.clearFiltersByKey
export const maybeApplyLinkFilter = http.maybeApplyLinkFilter

export const filterByValidSalesChannels = nativeMw.filterByValidSalesChannels
export const transformAndValidateSalesChannelIds = nativeMw.transformAndValidateSalesChannelIds
export const prepareInventoryQuantityFields = nativeMw.prepareInventoryQuantityFields
export const normalizeDataForContext = nativeMw.normalizeDataForContext
export const setPricingContext = nativeMw.setPricingContext
export const setTaxContext = nativeMw.setTaxContext
export const wrapVariantsWithInventoryQuantityForSalesChannel =
  nativeMw.wrapVariantsWithInventoryQuantityForSalesChannel
export const wrapVariantsWithTotalInventoryQuantity = nativeMw.wrapVariantsWithTotalInventoryQuantity

export const listProductQueryConfig = productsQueryConfig.listProductQueryConfig
export const StoreGetProductsParams = productsValidators.StoreGetProductsParams
export const wrapProductsWithTaxPrices: (req: MedusaRequest, products: unknown[]) => Promise<void> =
  productsHelpers.wrapProductsWithTaxPrices
export const listProductCategoryConfig = categoriesQueryConfig.listProductCategoryConfig
export const StoreProductCategoriesParams = categoriesValidators.StoreProductCategoriesParams
export const applyCategoryFilters: MiddlewareFn = categoriesHelpers.applyCategoryFilters
export const publishedProductsContext: () => Record<string, unknown> = publishedProducts.publishedProductsContext

export function getRegisteredSearchIndexes(): SearchTypes.SearchIndexDefinition[] {
  return modulesSdk.MedusaModule.getSearchIndexes?.() ?? []
}
