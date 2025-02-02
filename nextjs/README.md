# Add search to Medusa NextJS starter

These are instructions on how to add search to a [Medusa NextJS starter](https://github.com/medusajs/nextjs-starter-medusa) project.

1. Open the Medusa NextJS starter project, or clone it if you haven't already
2. Copy [search.patch](search.patch) to the root of the project
3. Apply the patch with the command `git apply search.patch`
4. You might need to install packages and add environment variables

### Required packages:

- MeiliSearch: `@meilisearch/instant-meilisearch@meilisearch/instant-meilisearch@^0.24.0`
- React InstantSearch: `react-instantsearch@^7.15.3`

### Environment variables:

- `NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true`
- `NEXT_PUBLIC_SEARCH_ENDPOINT=http://127.0.0.1:7700`
- `NEXT_PUBLIC_SEARCH_API_KEY=ms`
- `NEXT_PUBLIC_INDEX_NAME=products`

### Storefront version

This patch is tested with the following version of the Medusa NextJS starter:
https://github.com/medusajs/nextjs-starter-medusa/tree/740b4a5a4f62d175bab538d5ed05017951910e61
