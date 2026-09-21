import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toEngineLocale, toEngineLocales } from '../../src/providers/meilisearch/utils/locales'

describe('toEngineLocale', () => {
  it('reduces a BCP-47 tag to its language subtag', () => {
    assert.equal(toEngineLocale('fr-FR'), 'fr')
    assert.equal(toEngineLocale('en'), 'en')
    assert.equal(toEngineLocale('pes_IR'), 'pes')
  })

  it('returns undefined for a language Meilisearch does not tokenize', () => {
    assert.equal(toEngineLocale('is-IS'), undefined)
    assert.equal(toEngineLocale('isl'), undefined)
    assert.equal(toEngineLocale('xx'), undefined)
  })
})

describe('toEngineLocales', () => {
  it('keeps the tokenized languages and deduplicates them', () => {
    assert.deepEqual(toEngineLocales(['en-US', 'en-GB', 'pl-PL']), ['en', 'pl'])
  })

  it('drops the languages Meilisearch does not tokenize', () => {
    assert.deepEqual(toEngineLocales(['is-IS', 'en-US']), ['en'])
    assert.deepEqual(toEngineLocales(['is-IS']), [])
  })
})
