import { LoaderOptions } from '@medusajs/types'
import { MeiliSearchService } from '../services'
import { MeilisearchPluginOptions } from '../types'
import { asValue } from 'awilix'

export default async ({ container, options }: LoaderOptions<MeilisearchPluginOptions>): Promise<void> => {
  if (!options) {
    throw new Error('Missing meilisearch configuration')
  }

  const meilisearchService: MeiliSearchService = new MeiliSearchService(container, options)
  const { settings } = options

  container.register({
    meilisearchService: asValue(meilisearchService),
  })

  await Promise.all(
    Object.entries(settings || {}).map(async ([indexName, value]) => {
      return await meilisearchService.updateSettings(indexName, value)
    }),
  )
}
