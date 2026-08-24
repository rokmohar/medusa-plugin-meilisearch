import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import z from 'zod'
import { HitsSearchSchema, runHitsSearch, toSearchRequestParams, type MeiliHitsEnvelope } from '../../../utils/search'
import '../../../types'

export const StoreSearchCategoriesSchema = HitsSearchSchema

export type StoreSearchCategoriesParams = z.infer<typeof StoreSearchCategoriesSchema>

export type CategoriesHitsResponse = MeiliHitsEnvelope

export async function GET(
  req: MedusaRequest<unknown, StoreSearchCategoriesParams>,
  res: MedusaResponse<CategoriesHitsResponse>,
) {
  res.json(await runHitsSearch(req, 'product_category', toSearchRequestParams(req.validatedQuery)))
}
