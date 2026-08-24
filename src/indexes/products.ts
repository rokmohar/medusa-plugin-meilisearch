import type { Event, SearchTypes } from '@medusajs/types'
import { ProductEvents, defineSearchIndex, search } from '@medusajs/utils'
import {
  createDefaultTransform,
  createSeed,
  parseEventName,
  reconcileIds,
  resolveEventIds,
  resolveRelatedIds,
} from './graph'
import { expandLocales } from './locales'
import type { ResolvedFactoryOptions, SearchIndexFactoryOptions } from './types'

export const PRODUCT_INDEX_NAME = 'products'
export const PRODUCT_ENTITY = 'product'

export const PRODUCT_GRAPH_FIELDS = [
  'id',
  'title',
  'subtitle',
  'description',
  'handle',
  'status',
  'thumbnail',
  'is_giftcard',
  'discountable',
  'collection_id',
  'type_id',
  'created_at',
  'updated_at',
  'collection.id',
  'collection.title',
  'collection.handle',
  'type.id',
  'type.value',
  'categories.id',
  'categories.name',
  'categories.handle',
  'tags.id',
  'tags.value',
  'variants.id',
  'variants.title',
  'variants.sku',
  'variants.barcode',
]

export const PRODUCT_EVENTS = [
  'product.created',
  'product.updated',
  'product.deleted',
  'product-variant.created',
  'product-variant.updated',
  'product-variant.deleted',
  'product-category.created',
  'product-category.updated',
  'product-category.deleted',
  'product-collection.updated',
  'product-collection.deleted',
  'product-tag.created',
  'product-tag.updated',
  'product-tag.deleted',
  'product-type.updated',
  'product-type.deleted',
  'product-option.updated',
  'product-option.deleted',
  'product-option-value.updated',
  'product-option-value.deleted',
  ProductEvents.PRODUCT_CREATED,
  ProductEvents.PRODUCT_UPDATED,
  ProductEvents.PRODUCT_DELETED,
  ProductEvents.PRODUCT_VARIANT_CREATED,
  ProductEvents.PRODUCT_VARIANT_UPDATED,
  ProductEvents.PRODUCT_VARIANT_DELETED,
  ProductEvents.PRODUCT_CATEGORY_CREATED,
  ProductEvents.PRODUCT_CATEGORY_UPDATED,
  ProductEvents.PRODUCT_CATEGORY_DELETED,
  ProductEvents.PRODUCT_COLLECTION_UPDATED,
  ProductEvents.PRODUCT_COLLECTION_DELETED,
  ProductEvents.PRODUCT_TAG_CREATED,
  ProductEvents.PRODUCT_TAG_UPDATED,
  ProductEvents.PRODUCT_TAG_DELETED,
  ProductEvents.PRODUCT_TYPE_UPDATED,
  ProductEvents.PRODUCT_TYPE_DELETED,
  ProductEvents.PRODUCT_OPTION_UPDATED,
  ProductEvents.PRODUCT_OPTION_DELETED,
  ProductEvents.PRODUCT_OPTION_VALUE_UPDATED,
  ProductEvents.PRODUCT_OPTION_VALUE_DELETED,
]

export function productSearchSchema() {
  return {
    id: search.keyword().filterable(),
    title: search.text().searchable({ weight: 5 }).sortable(),
    subtitle: search.text().searchable({ weight: 2 }),
    description: search.text().searchable({ weight: 3 }),
    handle: search.keyword().filterable(),
    status: search.keyword().filterable().facetable(),
    thumbnail: search.keyword().retrievable(),
    is_giftcard: search.boolean().filterable(),
    discountable: search.boolean().filterable(),
    collection_id: search.keyword().filterable(),
    type_id: search.keyword().filterable(),
    collection: search.object({
      id: search.keyword().filterable(),
      title: search.text().searchable().facetable(),
      handle: search.keyword().filterable(),
    }),
    type: search.object({
      id: search.keyword().filterable(),
      value: search.keyword().filterable().facetable(),
    }),
    categories: search
      .object({
        id: search.keyword().filterable().facetable(),
        name: search.text().searchable({ weight: 2 }).facetable(),
        handle: search.keyword().filterable(),
      })
      .array(),
    tags: search
      .object({
        id: search.keyword().filterable(),
        value: search.text().searchable().facetable(),
      })
      .array(),
    variants: search
      .object({
        id: search.keyword().filterable(),
        title: search.text().searchable({ weight: 2 }),
        sku: search.text().searchable({ weight: 4 }).filterable(),
        barcode: search.keyword().filterable(),
      })
      .array(),
    created_at: search
      .date()
      .filterable()
      .sortable()
      .facetable({ types: ['range'] }),
    updated_at: search.date().filterable().sortable(),
  }
}

export function defineProductSearchIndex(options: SearchIndexFactoryOptions = {}): SearchTypes.SearchIndexDefinition[] {
  const base = options.name ?? PRODUCT_INDEX_NAME

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
      consume: options.consume ?? createProductConsume(resolved),
      seed: createSeed(resolved),
    })
  })
}

function resolveOptions(
  name: string,
  locale: string | undefined,
  options: SearchIndexFactoryOptions,
): ResolvedFactoryOptions {
  const graphFields = [...new Set([...PRODUCT_GRAPH_FIELDS, ...(options.graph_fields ?? [])])]
  const settings = { ...options.settings }

  if (locale && !settings.locales) {
    settings.locales = [locale]
  }

  return {
    name,
    entity: PRODUCT_ENTITY,
    provider: options.provider,
    primaryKey: options.primary_key ?? 'id',
    fields: options.fields ?? search.define(productSearchSchema()),
    settings,
    graphFields,
    filters: options.filters ?? { status: 'published' },
    transform: options.transform ?? createDefaultTransform(graphFields),
    batchSize: options.batch_size ?? 200,
    events: options.events ?? PRODUCT_EVENTS,
    locale,
  }
}

function createProductConsume(
  options: ResolvedFactoryOptions,
): NonNullable<SearchTypes.SearchIndexDefinition['consume']> {
  return async (event: Event<unknown>, { container }) => {
    const ids = resolveEventIds(event)

    if (!ids.length) {
      return []
    }

    const { entity, action } = parseEventName(event.name)

    if (entity === PRODUCT_ENTITY) {
      if (action === 'deleted') {
        return [{ action: 'delete', filters: { id: ids } }]
      }

      return reconcileIds(container.query, options, ids)
    }

    if (action === 'deleted') {
      return []
    }

    const productIds = await resolveProductIds(container.query, entity, ids)

    return reconcileIds(container.query, options, productIds)
  }
}

async function resolveProductIds(
  query: SearchTypes.SearchContainer['query'],
  entity: string,
  ids: string[],
): Promise<string[]> {
  switch (entity) {
    case 'product-variant':
      return resolveRelatedIds(query, { entity: 'product_variant', field: 'product_id', filters: { id: ids } })
    case 'product-option':
      return resolveRelatedIds(query, { entity: 'product_option', field: 'product_id', filters: { id: ids } })
    case 'product-option-value':
      return resolveRelatedIds(query, {
        entity: 'product_option_value',
        field: 'option.product_id',
        filters: { id: ids },
      })
    case 'product-category':
      return resolveRelatedIds(query, { entity: PRODUCT_ENTITY, field: 'id', filters: { categories: { id: ids } } })
    case 'product-collection':
      return resolveRelatedIds(query, { entity: PRODUCT_ENTITY, field: 'id', filters: { collection_id: ids } })
    case 'product-tag':
      return resolveRelatedIds(query, { entity: PRODUCT_ENTITY, field: 'id', filters: { tags: { id: ids } } })
    case 'product-type':
      return resolveRelatedIds(query, { entity: PRODUCT_ENTITY, field: 'id', filters: { type_id: ids } })
    default:
      return []
  }
}
