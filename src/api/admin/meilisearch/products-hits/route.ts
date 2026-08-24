import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import z from 'zod'
import { HitsSearchSchema, runHitsSearch, toSearchRequestParams, type MeiliHitsEnvelope } from '../../../utils/search'
import '../../../types'

export const AdminSearchProductsSchema = HitsSearchSchema

export type AdminSearchProductsParams = z.infer<typeof AdminSearchProductsSchema>

export type AdminProductsHitsResponse = MeiliHitsEnvelope

export async function POST(
  req: MedusaRequest<AdminSearchProductsParams>,
  res: MedusaResponse<AdminProductsHitsResponse>,
) {
  res.json(await runHitsSearch(req, 'product', toSearchRequestParams(req.validatedBody)))
}
