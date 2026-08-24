import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import z from 'zod'
import { ContainerRegistrationKeys, MedusaError } from '../../../utils/medusa'
import { resolveSearchModule } from '../../../utils/search'

export const AdminSyncSchema = z.object({
  index: z.union([z.string(), z.array(z.string())]).optional(),
  strategy: z.enum(['swap', 'in_place']).optional(),
})

export type AdminSyncParams = z.infer<typeof AdminSyncSchema>

export interface AdminSyncResponse {
  message: string
  indexes: string[]
}

export function POST(req: MedusaRequest, res: MedusaResponse<AdminSyncResponse>) {
  const parsed = AdminSyncSchema.safeParse(req.body ?? {})

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue.path.join('.')

    throw new MedusaError(MedusaError.Types.INVALID_DATA, path ? `${path}: ${issue.message}` : issue.message)
  }

  const { index, strategy } = parsed.data
  const searchModule = resolveSearchModule(req)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const requested = index === undefined ? searchModule.listIndexes() : Array.isArray(index) ? index : [index]

  void searchModule
    .reindex({ index, strategy })
    .then((result) => {
      logger.info(`Meilisearch reindex finished for ${result.indexes.join(', ')} (job ${result.job_id})`)
    })
    .catch((error: unknown) => {
      logger.error(`Meilisearch reindex failed: ${error instanceof Error ? error.message : String(error)}`)
    })

  res.json({
    message: `Reindex started for ${requested.length} index(es)`,
    indexes: requested,
  })
}
