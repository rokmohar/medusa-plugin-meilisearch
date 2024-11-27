"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformProduct = void 0;
const utils_1 = require("@medusajs/utils");
const prefix = `variant`;
const transformProduct = (product) => {
    const transformedProduct = { ...product };
    const initialObj = utils_1.variantKeys.reduce((obj, key) => {
        obj[`${prefix}_${key}`] = [];
        return obj;
    }, {});
    initialObj[`${prefix}_options_value`] = [];
    const flattenedVariantFields = (product.variants ?? []).reduce((obj, variant) => {
        utils_1.variantKeys.forEach((k) => {
            if (k === 'options' && variant[k]) {
                const values = variant[k].map((option) => option.value);
                obj[`${prefix}_options_value`] = obj[`${prefix}_options_value`].concat(values);
                return;
            }
            return variant[k] && obj[`${prefix}_${k}`].push(variant[k]);
        });
        return obj;
    }, initialObj);
    transformedProduct.type_value = product.type && product.type.value;
    transformedProduct.collection_title = product.collection && product.collection.title;
    transformedProduct.collection_handle = product.collection && product.collection.handle;
    transformedProduct.tags_value = product.tags ? product.tags.map((t) => t.value) : [];
    transformedProduct.categories = (product?.categories || []).map((c) => c.name);
    return {
        ...transformedProduct,
        ...flattenedVariantFields,
    };
};
exports.transformProduct = transformProduct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvdHJhbnNmb3JtZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkNBQTZDO0FBRTdDLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQTtBQUVqQixNQUFNLGdCQUFnQixHQUFHLENBQUMsT0FBWSxFQUFFLEVBQUU7SUFDL0MsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLEdBQUcsT0FBTyxFQUE2QixDQUFBO0lBRXBFLE1BQU0sVUFBVSxHQUFHLG1CQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFO1FBQ2pELEdBQUcsQ0FBQyxHQUFHLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUM1QixPQUFPLEdBQUcsQ0FBQTtJQUNaLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQTtJQUNOLFVBQVUsQ0FBQyxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsR0FBRyxFQUFFLENBQUE7SUFFMUMsTUFBTSxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQzlFLG1CQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDeEIsSUFBSSxDQUFDLEtBQUssU0FBUyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ3ZELEdBQUcsQ0FBQyxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFBO2dCQUM5RSxPQUFNO1lBQ1IsQ0FBQztZQUNELE9BQU8sT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUM3RCxDQUFDLENBQUMsQ0FBQTtRQUNGLE9BQU8sR0FBRyxDQUFBO0lBQ1osQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFBO0lBRWQsa0JBQWtCLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUE7SUFDbEUsa0JBQWtCLENBQUMsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLFVBQVUsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQTtJQUNwRixrQkFBa0IsQ0FBQyxpQkFBaUIsR0FBRyxPQUFPLENBQUMsVUFBVSxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFBO0lBQ3RGLGtCQUFrQixDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUE7SUFDcEYsa0JBQWtCLENBQUMsVUFBVSxHQUFHLENBQUMsT0FBTyxFQUFFLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUU5RSxPQUFPO1FBQ0wsR0FBRyxrQkFBa0I7UUFDckIsR0FBRyxzQkFBc0I7S0FDMUIsQ0FBQTtBQUNILENBQUMsQ0FBQTtBQS9CWSxRQUFBLGdCQUFnQixvQkErQjVCIn0=