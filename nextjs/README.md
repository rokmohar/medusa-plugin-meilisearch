# Add search to Medusa NextJS starter

These are instructions on how to add search to a [Medusa NextJS starter](https://github.com/medusajs/nextjs-starter-medusa) project.

1. Open the Medusa NextJS starter project, or clone it if you haven't already
2. Copy [search.patch](search.patch) to the root of the project
3. Apply the patch with the command `git apply search.patch`
4. You might need to install packages and add environment variables

Required packages:

- MeiliSearch: `@meilisearch/instant-meilisearch`
- React InstantSearch Hooks: `react-instantsearch-hooks-web`
