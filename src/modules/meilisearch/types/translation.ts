/**
 * Represents a translation for a translatable field
 */
export interface Translation {
  /**
   * The language code (e.g. 'en', 'fr')
   */
  language_code: string

  /**
   * The translated value
   */
  value: string
}

/**
 * Represents translations for a field
 */
export interface TranslationMap {
  [field: string]: Translation[]
}

/**
 * Configuration for a translatable field
 */
export interface TranslatableField {
  /**
   * The field name in the source object
   */
  source: string

  /**
   * Optional target field name in the translated object
   * If not provided, uses the source name
   */
  target?: string
}

/**
 * Options for transforming translations
 */
export interface TranslationOptions {
  /**
   * The language to prioritize
   */
  language?: string

  /**
   * The fallback language if translation not found
   */
  fallbackLanguage?: string

  /**
   * Whether to include all translations in the output
   */
  includeAllTranslations?: boolean

  /**
   * Configuration for translatable fields
   * Can be either an array of field names or field configurations
   */
  translatableFields?: (string | TranslatableField)[]
}

/**
 * Helper to normalize field configuration
 */
export function normalizeFieldConfig(field: string | TranslatableField): TranslatableField {
  if (typeof field === 'string') {
    return { source: field }
  }
  return field
}

/**
 * Helper to get a translation for a field
 */
export function getTranslation(
  translations: Translation[],
  language?: string,
  fallbackLanguage = 'en',
): string | undefined {
  if (!translations?.length) {
    return undefined
  }

  // Try to find translation in requested language
  if (language) {
    const translation = translations.find((t) => t.language_code === language)
    if (translation) {
      return translation.value
    }
  }

  // Fall back to the default language
  const fallback = translations.find((t) => t.language_code === fallbackLanguage)
  if (fallback) {
    return fallback.value
  }

  // Last resort - return first translation
  return translations[0].value
}
