// The languages Meilisearch tokenizes (ISO 639-1 and ISO 639-3), as listed by its `invalid_search_locales` error.
const ENGINE_LOCALES: ReadonlySet<string> = new Set(
  `af ak am ar az be bn bg ca cs da de el en eo et fi fr gu he hi hr hu hy id it jv ja kn ka km ko la lv lt ml mr mk
   my ne nl nb or pa fa pl pt ro ru si sk sl sn es sr sv ta te tl th tk tr uk ur uz vi yi zh zu
   afr aka amh ara aze bel ben bul cat ces dan deu ell eng epo est fin fra guj heb hin hrv hun hye ind ita jav jpn
   kan kat khm kor lat lav lit mal mar mkd mya nep nld nob ori pan pes pol por ron rus sin slk slv sna spa srp swe
   tam tel tgl tha tuk tur ukr urd uzb vie yid zho zul cmn`.split(/\s+/),
)

export function toEngineLocale(locale: string): string | undefined {
  const language = locale.split(/[-_]/)[0].toLowerCase()

  return ENGINE_LOCALES.has(language) ? language : undefined
}

export function toEngineLocales(locales: readonly string[]): string[] {
  const languages = new Set<string>()

  for (const locale of locales) {
    const language = toEngineLocale(locale)

    if (language) {
      languages.add(language)
    }
  }

  return [...languages]
}
