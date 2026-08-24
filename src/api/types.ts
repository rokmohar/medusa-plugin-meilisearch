/* eslint-disable @typescript-eslint/no-namespace */

export interface MeiliParams {
  query?: string
  language?: string
  index?: string
  filter?: string
  embedder?: string
  semanticSearch: boolean
  semanticRatio: number
}

declare global {
  namespace Express {
    interface Request {
      meiliParams?: MeiliParams
    }
  }
}
