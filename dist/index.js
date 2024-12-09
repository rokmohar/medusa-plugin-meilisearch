"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const loaders_1 = __importDefault(require("./loaders"));
const services_1 = require("./services");
const service = services_1.MeiliSearchService;
const loaders = [loaders_1.default];
const moduleDefinition = {
    service,
    loaders,
};
exports.default = moduleDefinition;
__exportStar(require("./initialize"), exports);
__exportStar(require("./services"), exports);
__exportStar(require("./types"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHdEQUE4QjtBQUM5Qix5Q0FBK0M7QUFHL0MsTUFBTSxPQUFPLEdBQUcsNkJBQWtCLENBQUE7QUFDbEMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxpQkFBTSxDQUFDLENBQUE7QUFFeEIsTUFBTSxnQkFBZ0IsR0FBa0I7SUFDdEMsT0FBTztJQUNQLE9BQU87Q0FDUixDQUFBO0FBRUQsa0JBQWUsZ0JBQWdCLENBQUE7QUFFL0IsK0NBQTRCO0FBQzVCLDZDQUEwQjtBQUMxQiwwQ0FBdUIifQ==