export function localeIndexName(base: string, locale: string): string {
  return `${base}-${locale}`
}

export function resolveLocaleIndexName(base: string, locale: string | undefined, registered: string[]): string {
  if (!locale) {
    return base
  }

  const exact = localeIndexName(base, locale)

  if (registered.includes(exact)) {
    return exact
  }

  const language = locale.split(/[-_]/)[0].toLowerCase()

  const prefixed = registered.find((name) => {
    if (!name.startsWith(`${base}-`)) {
      return false
    }

    return (
      name
        .slice(base.length + 1)
        .toLowerCase()
        .split(/[-_]/)[0] === language
    )
  })

  return prefixed ?? base
}

export function expandLocales(
  base: string,
  locales: string[] | undefined,
  defaultLocale: string | undefined,
): { name: string; locale?: string }[] {
  if (!locales?.length) {
    return [{ name: base }]
  }

  const primary = defaultLocale && locales.includes(defaultLocale) ? defaultLocale : locales[0]

  return locales.map((locale) => {
    return locale === primary ? { name: base, locale } : { name: localeIndexName(base, locale), locale }
  })
}
