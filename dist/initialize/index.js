"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = void 0;
const modules_sdk_1 = require("@medusajs/modules-sdk");
const initialize = async (options) => {
    const serviceKey = 'medusa-plugin-meilisearch';
    const loaded = await modules_sdk_1.MedusaModule.bootstrap({
        moduleKey: serviceKey,
        defaultPath: '@rokmohar/medusa-plugin-meilisearch',
        declaration: options,
    });
    return loaded[serviceKey];
};
exports.initialize = initialize;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5pdGlhbGl6ZS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx1REFBb0Q7QUFRN0MsTUFBTSxVQUFVLEdBQUcsS0FBSyxFQUM3QixPQUE4RCxFQUNyQyxFQUFFO0lBQzNCLE1BQU0sVUFBVSxHQUFHLDJCQUEyQixDQUFBO0lBQzlDLE1BQU0sTUFBTSxHQUFHLE1BQU0sMEJBQVksQ0FBQyxTQUFTLENBQWlCO1FBQzFELFNBQVMsRUFBRSxVQUFVO1FBQ3JCLFdBQVcsRUFBRSxxQ0FBcUM7UUFDbEQsV0FBVyxFQUFFLE9BRWdCO0tBQzlCLENBQUMsQ0FBQTtJQUVGLE9BQU8sTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFBO0FBQzNCLENBQUMsQ0FBQTtBQWJZLFFBQUEsVUFBVSxjQWF0QiJ9