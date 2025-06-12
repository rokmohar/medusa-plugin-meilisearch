import { DefaultProductTransformer, I18nConfig } from '../types'
import { TranslationMap, TranslationOptions, getTranslation, normalizeFieldConfig } from '../types/translation'
import { ProductDTO } from '@medusajs/types'

export interface TransformOptions extends TranslationOptions {
  i18n?: I18nConfig
  translations?: TranslationMap
}

export const transformProduct: DefaultProductTransformer = (product: ProductDTO, options?: TransformOptions) => {
  const {
    i18n,
    language,
    fallbackLanguage,
    includeAllTranslations,
    translatableFields: configFields,
    translations = {},
  } = options || {}

  if (!i18n) {
    return { ...product } as Record<string, unknown>
  }

  const defaultLang = i18n.defaultLanguage
  const currentLang = language || defaultLang

  // Determine translatable fields
  let translatableFields = (configFields || []).map(normalizeFieldConfig)

  // If no fields specified and using field-suffix strategy,
  // auto-detect string fields as translatable
  if (i18n.strategy === 'field-suffix' && !translatableFields.length) {
    translatableFields = Object.entries(product)
      .filter(([, value]) => typeof value === 'string')
      .map(([key]) => ({ source: key }))
  }

  if (i18n.strategy === 'field-suffix') {
    const result: Record<string, unknown> = { ...product }

    // For each translatable field, create language-specific fields
    translatableFields.forEach((fieldConfig) => {
      const sourceField = fieldConfig.source
      const targetField = fieldConfig.target || sourceField

      // Get translations for this field
      const fieldTranslations = translations[targetField] || []

      if (includeAllTranslations) {
        // Include all translations with language suffixes
        fieldTranslations.forEach((translation) => {
          result[`${targetField}_${translation.language_code}`] = translation.value
        })
      } else {
        // Only include current language translation
        const translatedValue = getTranslation(fieldTranslations, currentLang, fallbackLanguage || defaultLang)
        if (translatedValue) {
          result[`${targetField}_${currentLang}`] = translatedValue

          // Keep the default language value in the original field
          if (currentLang === defaultLang) {
            result[targetField] = translatedValue
          }
        }
      }
    })

    return result
  }

  // For separate-index strategy, return the product with translations for current language
  const result: Record<string, unknown> = { ...product }

  translatableFields.forEach((fieldConfig) => {
    const sourceField = fieldConfig.source
    const targetField = fieldConfig.target || sourceField

    const fieldTranslations = translations[targetField] || []
    const translatedValue = getTranslation(fieldTranslations, currentLang, fallbackLanguage || defaultLang)

    if (translatedValue) {
      result[targetField] = translatedValue
    }
  })

  return result
}
