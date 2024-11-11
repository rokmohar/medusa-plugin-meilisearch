import { defineJoinerConfig } from "@medusajs/utils"

export const joinerConfig = defineJoinerConfig('@rokmohar/medusa-plugin-meilisearch', {
  models: [{ name: "Meilisearch" }],
})