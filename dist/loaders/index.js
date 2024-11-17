"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = require("../services");
const awilix_1 = require("awilix");
exports.default = async ({ container, options }) => {
    if (!options) {
        throw new Error('Missing meilisearch configuration');
    }
    const meiliSearchService = new services_1.MeiliSearchService(container, options);
    const { settings } = options;
    container.register({
        meiliSearchService: (0, awilix_1.asValue)(meiliSearchService),
    });
    await Promise.all(Object.entries(settings || {}).map(async ([indexName, value]) => {
        return await meiliSearchService.updateSettings(indexName, value);
    }));
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbG9hZGVycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLDBDQUFnRDtBQUVoRCxtQ0FBZ0M7QUFFaEMsa0JBQWUsS0FBSyxFQUFFLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBMkMsRUFBaUIsRUFBRTtJQUN0RyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDYixNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUE7SUFDdEQsQ0FBQztJQUVELE1BQU0sa0JBQWtCLEdBQXVCLElBQUksNkJBQWtCLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFBO0lBQ3pGLE1BQU0sRUFBRSxRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUE7SUFFNUIsU0FBUyxDQUFDLFFBQVEsQ0FBQztRQUNqQixrQkFBa0IsRUFBRSxJQUFBLGdCQUFPLEVBQUMsa0JBQWtCLENBQUM7S0FDaEQsQ0FBQyxDQUFBO0lBRUYsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtRQUM5RCxPQUFPLE1BQU0sa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQTtJQUNsRSxDQUFDLENBQUMsQ0FDSCxDQUFBO0FBQ0gsQ0FBQyxDQUFBIn0=