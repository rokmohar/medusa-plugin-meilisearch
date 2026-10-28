# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - Unreleased

### Changed

- Supports Medusa 2.22: peer dependencies move to `~2.22.0`.
- A request that names an `embedder` runs a hybrid search against it, even on an index with a vector field.
- `GET /store/meilisearch/categories` also answers under `product_categories`, the native route's key. `categories`
  stays for existing storefronts.
- Development dependencies updated to their latest versions compatible with Medusa 2.22.
- The Next.js guide now targets the [Medusa DTC starter](https://github.com/medusajs/dtc-starter) and lives in
  [docs/nextjs](./docs/nextjs/README.md). Its patch moves the starter's search page onto
  `GET /store/meilisearch/products` instead of querying Meilisearch from the browser.

### Fixed

- `GET /store/meilisearch/products?query=` returned products from sales channels outside the request's, and an unscoped
  `count`. The engine query is now narrowed to published products in the requested sales channels (the
  `sales_channel_id` passed, or every channel of the publishable key), the same way native `POST /store/search`
  narrows it, and a raw `filter` can no longer widen that scope.
- `GET /store/meilisearch/categories` returned inactive and internal categories and unpublished related products, unlike
  the native route, and dropped a caller's `id` filter while searching.
- `GET /store/meilisearch/products` returned no stock for `fields=variants.inventory_quantity` without the `+` prefix;
  it now prepares the inventory fields the way the native route does.
- `semanticSearch=true` failed on indexes with a vector field. A field that declares `embed()` now embeds the query; a
  field holding pre-computed embeddings answers with a 400 that points to `search_options.vector.value`.

## [2.3.1] - 2026-10-03

### Fixed

- Recreates missing indexes before writing to them.
- Date and null filtering, and date facets.
- Stores vectors under `_vectors`, where Meilisearch reads them. Reindex vector indexes with `strategy: 'swap'`.

## [2.3.0] - 2026-10-03

### Added

- The product declaration gains a filterable `sales_channel_ids`, so `POST /store/search` scopes product hits to the
  publishable key's sales channels.
- `query_context` index option, passing a `query.graph` context such as a pricing context to every seed and ingestion
  read.
- Meilisearch rate-limit errors (429) are translated with their `retry_after`.

### Changed

- Requires Medusa 2.21.1 or a later 2.21 patch (`~2.21.1`), the release that ships `POST /store/search`.
- Requires Node 22.12 or newer: the Meilisearch client moves to `^0.62.0`, which is published as ES modules only.
- A custom `transform` must return a document with an `id`; a missing one fails the batch instead of deleting the row.
- Deleting a variant or a product option re-indexes its product, and a catch-up pass removes rows that stopped matching
  the index `filters` during a rebuild.

### Fixed

- Only sends Meilisearch the locales it tokenizes.

## [2.2.0] - 2026-09-11

### Changed

- Supports Medusa 2.21.
- Engine-specific settings, localized indexes included, move under `settings.provider_options.meilisearch`.

## [2.1.0] - 2026-09-11

### Changed

- Targets Medusa 2.20, with development and peer dependencies aligned to it.

### Fixed

- Awaits `listIndexes()`, which Medusa 2.20 made asynchronous, when resolving index names and in the admin index and
  sync routes.
- Type errors against Medusa 2.20.

## [2.0.0] - 2026-08-24

### Changed

- Rewritten as a provider for the Search Module introduced in Medusa 2.19. Indexing, seeding and event handling move
  to the module; the plugin keeps the provider, index factories, store and admin routes, and the admin page. See the
  [upgrade guide](./docs/migration.md).
- Published through npm trusted publishing.

## 1.x

The 1.x line supports Medusa 2.4 to 2.18. Its history is in the
[GitHub releases](https://github.com/rokmohar/medusa-plugin-meilisearch/releases) and tags.

[2.4.0]: https://github.com/rokmohar/medusa-plugin-meilisearch/compare/v2.3.1...HEAD
[2.3.1]: https://github.com/rokmohar/medusa-plugin-meilisearch/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/rokmohar/medusa-plugin-meilisearch/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/rokmohar/medusa-plugin-meilisearch/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/rokmohar/medusa-plugin-meilisearch/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/rokmohar/medusa-plugin-meilisearch/compare/v1.4.3...v2.0.0
