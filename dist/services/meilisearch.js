"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeiliSearchService = void 0;
const utils_1 = require("@medusajs/utils");
const meilisearch_1 = require("meilisearch");
const types_1 = require("../types");
const transformer_1 = require("../utils/transformer");
const joiner_config_1 = require("../joiner-config");
class MeiliSearchService extends utils_1.SearchUtils.AbstractSearchService {
    constructor(container, options) {
        super(container, options);
        this.isDefault = false;
        this.config_ = options;
        if (process.env.NODE_ENV !== 'development') {
            if (!options.config?.apiKey) {
                throw Error('Meilisearch API key is missing in plugin config. See https://docs.medusajs.com/add-plugins/meilisearch');
            }
        }
        if (!options.config?.host) {
            throw Error('Meilisearch host is missing in plugin config. See https://docs.medusajs.com/add-plugins/meilisearch');
        }
        this.client_ = new meilisearch_1.MeiliSearch(options.config);
    }
    __joinerConfig() {
        return joiner_config_1.joinerConfig;
    }
    async createIndex(indexName, options = { primaryKey: 'id' }) {
        return await this.client_.createIndex(indexName, options);
    }
    getIndex(indexName) {
        return this.client_.index(indexName);
    }
    async addDocuments(indexName, documents, type) {
        const transformedDocuments = this.getTransformedDocuments(type, documents);
        return await this.client_.index(indexName).addDocuments(transformedDocuments, { primaryKey: 'id' });
    }
    async replaceDocuments(indexName, documents, type) {
        const transformedDocuments = this.getTransformedDocuments(type, documents);
        return await this.client_.index(indexName).addDocuments(transformedDocuments, { primaryKey: 'id' });
    }
    async deleteDocument(indexName, documentId) {
        return await this.client_.index(indexName).deleteDocument(documentId);
    }
    async deleteAllDocuments(indexName) {
        return await this.client_.index(indexName).deleteAllDocuments();
    }
    async search(indexName, query, options) {
        const { paginationOptions, filter, additionalOptions } = options;
        return await this.client_.index(indexName).search(query, { filter, ...paginationOptions, ...additionalOptions });
    }
    async updateSettings(indexName, settings) {
        const indexSettings = settings.indexSettings ?? {};
        await this.upsertIndex(indexName, settings);
        return await this.client_.index(indexName).updateSettings(indexSettings);
    }
    async upsertIndex(indexName, settings) {
        try {
            await this.client_.getIndex(indexName);
        }
        catch (error) {
            if (error.code === types_1.meilisearchErrorCodes.INDEX_NOT_FOUND) {
                await this.createIndex(indexName, {
                    primaryKey: settings?.primaryKey ?? 'id',
                });
            }
        }
    }
    getTransformedDocuments(type, documents) {
        if (!documents?.length) {
            return [];
        }
        switch (type) {
            case utils_1.SearchUtils.indexTypes.PRODUCTS:
                const productsTransformer = this.config_.settings?.[utils_1.SearchUtils.indexTypes.PRODUCTS]?.transformer ?? transformer_1.transformProduct;
                return documents.map(productsTransformer);
            default:
                return documents;
        }
    }
}
exports.MeiliSearchService = MeiliSearchService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVpbGlzZWFyY2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc2VydmljZXMvbWVpbGlzZWFyY2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsMkNBQTZDO0FBQzdDLDZDQUFtRDtBQUNuRCxvQ0FBMEU7QUFDMUUsc0RBQXVEO0FBQ3ZELG9EQUFnRDtBQUVoRCxNQUFhLGtCQUFtQixTQUFRLG1CQUFXLENBQUMscUJBQXFCO0lBTXZFLFlBQVksU0FBUyxFQUFFLE9BQWlDO1FBQ3RELEtBQUssQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUE7UUFOM0IsY0FBUyxHQUFHLEtBQUssQ0FBQTtRQVFmLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFBO1FBRXRCLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYSxFQUFFLENBQUM7WUFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUM7Z0JBQzVCLE1BQU0sS0FBSyxDQUNULHdHQUF3RyxDQUN6RyxDQUFBO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUMxQixNQUFNLEtBQUssQ0FBQyxxR0FBcUcsQ0FBQyxDQUFBO1FBQ3BILENBQUM7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUkseUJBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7SUFDaEQsQ0FBQztJQUVELGNBQWM7UUFDWixPQUFPLDRCQUFZLENBQUE7SUFDckIsQ0FBQztJQUVELEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBaUIsRUFBRSxVQUFtQyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUU7UUFDMUYsT0FBTyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQTtJQUMzRCxDQUFDO0lBRUQs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