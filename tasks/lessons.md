# Lessons

## Immutable shared values are consts, not factories

A factory function that always returns the same immutable value should be a `const` (e.g. `HitsSearchSchema` in
`src/api/utils/search.ts`). Only keep a factory when each caller genuinely needs a fresh object — Medusa's search field
builders (`search.keyword()`, `.filterable()`) mutate in place and return `this`, so `productSearchSchema()` and
`categorySearchSchema()` must stay functions or index declarations would share mutable field objects.

Before turning one into the other: check whether the returned value is mutated by its consumers.

## Earn every type assertion

`as unknown as X` is a last resort, not the default for test doubles. Cheaper options first:

- Narrow the production signature to what the function actually uses (`Pick<ISearchModuleService, 'listIndexes'>`), so a
  small fake satisfies it with no assertion at all.
- Type the double as `Partial<TheRealType>` and assert once. This keeps field names and shapes checked — it is what
  caught the incomplete `publishable_key_context` fake and the wrong `SearchResult.metadata`.
- Reach for a double assertion only where the real type is an unimplementable surface (Express `Request`/`Response`),
  and keep it in one harness file rather than at every call site.

A type error against a hand-written type often means the production type is wrong: the `fields` collision with Medusa's
reserved `RequestQueryFields.fields` surfaced only because the test named the real request type.

## Read an option's semantics in the source, not off its name

The 2.3.0 plan proposed meilisearch-js `skipCreation` to stop writes from recreating dropped index versions. In the
client's types it means "update existing documents only", so it would have silently dropped every new product. The
same review claimed `reconcileIds` should key by `primary_key`; event payloads and native `graphConsume`'s transform
contract both key by `id`, so the hardcoded `id` was right and only the seed cursor needed the primary key.

Before a plan relies on a third-party option or a "native does X" comparison: open the `.d.ts`/source in
`node_modules` and trace where the value comes from end to end.
