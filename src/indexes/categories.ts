import type { Event, SearchTypes } from '@medusajs/types'
import { ProductEvents, defineSearchIndex, search } from '@medusajs/utils'
import { createDefaultTransform, createSeed, parseEventName, reconcileIds, resolveEventIds } from './graph'
import { expandLocales } from './locales'
import type { ResolvedFactoryOptions, SearchIndexFactoryOptions } from './types'

export const CATEGORY_INDEX_NAME = 'categories'
export const CATEGORY_ENTITY = 'product_category'

export const CATEGORY_GRAPH_FIELDS = [
  'id',
  'name',
  'description',
  'handle',
  'rank',
  'is_active',
  'is_internal',
  'parent_category_id',
  'created_at',
  'updated_at',
  'parent_category.id',
  'parent_category.name',
  'parent_category.handle',
]

export const CATEGORY_EVENTS = [
  'product-category.created',
  'product-category.updated',
  'product-category.deleted',
  ProductEvents.PRODUCT_CATEGORY_CREATED,
  ProductEvents.PRODUCT_CATEGORY_UPDATED,
  ProductEvents.PRODUCT_CATEGORY_DELETED,
]

export function categorySearchSchema() {
  return {
    id: search.keyword().filterable(),
    name: search.text().searchable({ weight: 5 }).sortable(),
    description: search.text().searchable({ weight: 2 }),
    handle: search.keyword().filterable(),
    rank: search.integer().filterable().sortable(),
    is_active: search.boolean().filterable().facetable(),
    is_internal: search.boolean().filterable(),
    parent_category_id: search.keyword().filterable(),
    parent_category: search.object({
      id: search.keyword().filterable(),
      name: search.text().searchable({ weight: 2 }),
      handle: search.keyword().filterable(),
    }),
    created_at: search.date().filterable().sortable(),
    updated_at: search.date().filterable().sortable(),
  }
}

export function defineCategorySearchIndex(
  options: SearchIndexFactoryOptions = {},
): SearchTypes.SearchIndexDefinition[] {
  const base = options.name ?? CATEGORY_INDEX_NAME

  return expandLocales(base, options.locales, options.default_locale).map(({ name, locale }) => {
    const resolved = resolveOptions(name, locale, options)

    return defineSearchIndex({
      name: resolved.name,
      entity: resolved.entity,
      primary_key: resolved.primaryKey,
      provider: resolved.provider,
      fields: resolved.fields,
      settings: resolved.settings,
      events: resolved.events,
      consume: options.consume ?? createCategoryConsume(resolved),
      seed: createSeed(resolved),
    })
  })
}

function resolveOptions(
  name: string,
  locale: string | undefined,
  options: SearchIndexFactoryOptions,
): ResolvedFactoryOptions {
  const graphFields = [...new Set([...CATEGORY_GRAPH_FIELDS, ...(options.graph_fields ?? [])])]
  const settings = { ...options.settings }

  if (locale && !settings.locales) {
    settings.locales = [locale]
  }

  return {
    name,
    entity: CATEGORY_ENTITY,
    provider: options.provider,
    primaryKey: options.primary_key ?? 'id',
    fields: options.fields ?? search.define(categorySearchSchema()),
    settings,
    graphFields,
    filters: options.filters ?? { is_active: true, is_internal: false },
    transform: options.transform ?? createDefaultTransform(graphFields),
    batchSize: options.batch_size ?? 200,
    events: options.events ?? CATEGORY_EVENTS,
    locale,
  }
}

function createCategoryConsume(
  options: ResolvedFactoryOptions,
): NonNullable<SearchTypes.SearchIndexDefinition['consume']> {
  return async (event: Event<unknown>, { container }) => {
    const ids = resolveEventIds(event)

    if (!ids.length) {
      return []
    }

    const { action } = parseEventName(event.name)

    if (action === 'deleted') {
      return [{ action: 'delete', filters: { id: ids } }]
    }

    return reconcileIds(container.query, options, ids)
  }
}
