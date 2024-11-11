import { LoaderOptions } from '@medusajs/types'
import MeiliSearchService from '../services/meilisearch'
import { MeilisearchPluginOptions } from '../types'
import { asValue } from 'awilix'

export default async ({ container, options }: LoaderOptions<MeilisearchPluginOptions>): Promise<void> => {
  if (!options) {
    throw new Error('Missing meilisearch configuration')
  }

  const meiliSearchService: MeiliSearchService = new MeiliSearchService(container, options)
  const { settings } = options

  container.register({
    meiliSearchService: asValue(meiliSearchService),
  })

  await Promise.all(
    Object.entries(settings || {}).map(async ([indexName, value]) => {
      return await meiliSearchService.updateSettings(indexName, value)
    }),
  )
}
