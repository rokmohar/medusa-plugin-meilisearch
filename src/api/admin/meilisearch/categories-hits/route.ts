import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import z from 'zod'
import { HitsSearchSchema, runHitsSearch, toSearchRequestParams, type MeiliHitsEnvelope } from '../../../utils/search'
import '../../../types'

export const AdminSearchCategoriesSchema = HitsSearchSchema

export type AdminSearchCategoriesParams = z.infer<typeof AdminSearchCategoriesSchema>

export type AdminCategoriesHitsResponse = MeiliHitsEnvelope

export async function POST(
  req: MedusaRequest<AdminSearchCategoriesParams>,
  res: MedusaResponse<AdminCategoriesHitsResponse>,
) {
  res.json(await runHitsSearch(req, 'product_category', toSearchRequestParams(req.validatedBody)))
}
