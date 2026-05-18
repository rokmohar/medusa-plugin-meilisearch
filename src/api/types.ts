/* eslint-disable @typescript-eslint/no-namespace */

export interface MeiliParams {
  query?: string
  language?: string
  semanticSearch: boolean
  semanticRatio: number
}

// Augment Express.Request so req.meiliParams and req.locale are available
// on MedusaRequest (which extends Express.Request) without type casts.
declare global {
  namespace Express {
    interface Request {
      meiliParams?: MeiliParams
      locale?: string
    }
  }
}
