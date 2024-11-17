import {defineJoinerConfig} from "@medusajs/utils"

export const joinerConfig = defineJoinerConfig('@anwarpro/medusa-plugin-meilisearch', {
    models: [{name: "Meilisearch"}],
})