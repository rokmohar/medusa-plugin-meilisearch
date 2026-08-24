import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import type { SearchTypes } from '@medusajs/types'
import { getRegisteredSearchIndexes } from '../../../utils/medusa'

export interface AdminVectorStatusResponse {
  enabled: boolean
  provider?: string
  model?: string
  dimensions?: number
  embeddingFields: string[]
  semanticRatio: number
}

const DEFAULT_SEMANTIC_RATIO = 0.5

export function GET(_req: MedusaRequest, res: MedusaResponse<AdminVectorStatusResponse>) {
  const definitions = getRegisteredSearchIndexes()

  const vectorFields = definitions.flatMap((definition) => {
    return Object.entries(definition.fields)
      .filter(([, field]) => {
        return field.type === 'vector'
      })
      .map(([name, field]) => {
        return { name, dimensions: field.dimensions }
      })
  })

  const embedder = definitions.flatMap(readEmbedders).at(0)

  if (!vectorFields.length && !embedder) {
    res.json({ enabled: false, embeddingFields: [], semanticRatio: DEFAULT_SEMANTIC_RATIO })

    return
  }

  res.json({
    enabled: true,
    provider: embedder ? asString(embedder.config.source) : 'userProvided',
    model: embedder ? asString(embedder.config.model) : undefined,
    dimensions: embedder ? asNumber(embedder.config.dimensions) : vectorFields[0]?.dimensions,
    embeddingFields: embedder
      ? readTemplateFields(asString(embedder.config.documentTemplate))
      : vectorFields.map((field) => {
          return field.name
        }),
    semanticRatio: DEFAULT_SEMANTIC_RATIO,
  })
}

function readEmbedders(
  definition: SearchTypes.SearchIndexDefinition,
): { name: string; config: Record<string, unknown> }[] {
  const providerOptions = definition.settings?.provider_options?.meilisearch

  if (!isRecord(providerOptions) || !isRecord(providerOptions.embedders)) {
    return []
  }

  return Object.entries(providerOptions.embedders).flatMap(([name, config]) => {
    return isRecord(config) ? [{ name, config }] : []
  })
}

function readTemplateFields(template: string | undefined): string[] {
  if (!template) {
    return []
  }

  return [...template.matchAll(/\{\{\s*doc\.([A-Za-z0-9_.]+)\s*\}\}/g)].map((match) => {
    return match[1]
  })
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
