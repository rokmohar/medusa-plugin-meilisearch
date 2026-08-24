import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import z from 'zod'
import { HitsSearchSchema, runHitsSearch, toSearchRequestParams, type MeiliHitsEnvelope } from '../../../utils/search'
import '../../../types'

export const StoreSearchProductsSchema = HitsSearchSchema

export type StoreSearchProductsParams = z.infer<typeof StoreSearchProductsSchema>

export type ProductsHitsResponse = MeiliHitsEnvelope

export async function GET(
  req: MedusaRequest<unknown, StoreSearchProductsParams>,
  res: MedusaResponse<ProductsHitsResponse>,
) {
  res.json(await runHitsSearch(req, 'product', toSearchRequestParams(req.validatedQuery)))
}
