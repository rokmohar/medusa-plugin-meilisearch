/**
 * Adapter around native Medusa internals so the custom Meilisearch endpoints can
 * behave exactly like the native /store/products and /store/product-categories routes.
 *
 * Several of these symbols live on subpaths (`@medusajs/framework/http`,
 * `@medusajs/medusa/api/...`) that the plugin's classic `moduleResolution: "node"`
 * tsconfig cannot resolve as `import` specifiers, and a few of them are non-public
 * Medusa internals that may move across majors. They are therefore loaded via
 * `require()` and re-exported with hand-written types. This file is the single
 * coupling point — if a Medusa upgrade breaks these, fix them here only.
 *
 * Verified against @medusajs/medusa ^2.15.x.
 */
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework'

// `@medusajs/utils` is a root-resolvable package (already used across this plugin).
export {
  ContainerRegistrationKeys,
  QueryContext,
  ProductStatus,
  MedusaError,
  isPresent,
  FeatureFlag,
} from '@medusajs/utils'

type MiddlewareFn = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => void | Promise<void>

interface NativeHttp {
  authenticate: (actor: string, methods: string[], options?: { allowUnauthenticated?: boolean }) => MiddlewareFn
  applyDefaultFilters: (defaults: Record<string, unknown>) => MiddlewareFn
  clearFiltersByKey: (keys: string[]) => MiddlewareFn
  maybeApplyLinkFilter: (config: { entryPoint: string; resourceId: string; filterableField: string }) => MiddlewareFn
}

interface NativeMiddlewares {
  filterByValidSalesChannels: () => MiddlewareFn
  normalizeDataForContext: () => MiddlewareFn
  setPricingContext: () => MiddlewareFn
  setTaxContext: () => MiddlewareFn
  wrapVariantsWithInventoryQuantityForSalesChannel: (req: MedusaRequest, variants: unknown[]) => Promise<void>
  wrapVariantsWithTotalInventoryQuantity: (req: MedusaRequest, variants: unknown[]) => Promise<void>
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
/* eslint-enable @typescript-eslint/no-require-imports */

export const authenticate = http.authenticate
export const applyDefaultFilters = http.applyDefaultFilters
export const clearFiltersByKey = http.clearFiltersByKey
export const maybeApplyLinkFilter = http.maybeApplyLinkFilter

export const filterByValidSalesChannels = nativeMw.filterByValidSalesChannels
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
