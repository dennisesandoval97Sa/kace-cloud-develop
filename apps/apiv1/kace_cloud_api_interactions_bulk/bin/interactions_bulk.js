'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
const interactions_bulk_stack_1 = require('../lib/interactions_bulk-stack');
const dotenv_1 = require('dotenv');
const node_path_1 = __importDefault(require('node:path')); // SONAR-EXC: Esta importación es nativa de NODE por lo que no es necesario agregarla como dependencia.
const KApiStack_1 = require('@kace/aws-infra/src/KApiStack');
const aws_cdk_lib_1 = require('aws-cdk-lib');
(0, dotenv_1.config)({ path: '../../../.env' });
const app = new aws_cdk_lib_1.App();
const props = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
};
const kProps = {
    ...KApiStack_1.KApiStack.KProps(),
    pathHandler: node_path_1.default.join(__dirname, '../src/handler.mjs'),
};
new interactions_bulk_stack_1.InteractionsBulkStack(app, 'InteractionsBulkStack', props, kProps); // SONAR-EXC: Esta instancia es necesaria para inicializar recursos en el stack.
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3Rpb25zX2J1bGsuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbnRlcmFjdGlvbnNfYnVsay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDRFQUF1RTtBQUN2RSxtQ0FBZ0M7QUFDaEMsMERBQTZCLENBQUMsdUdBQXVHO0FBQ3JJLDZEQUEwRTtBQUMxRSw2Q0FBa0M7QUFFbEMsSUFBQSxlQUFNLEVBQUMsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLENBQUMsQ0FBQztBQUVsQyxNQUFNLEdBQUcsR0FBRyxJQUFJLGlCQUFHLEVBQUUsQ0FBQztBQUN0QixNQUFNLEtBQUssR0FBRztJQUNWLEdBQUcsRUFBRTtRQUNELE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0I7S0FDekM7Q0FDSixDQUFDO0FBRUYsTUFBTSxNQUFNLEdBQW1CO0lBQzNCLEdBQUcscUJBQVMsQ0FBQyxNQUFNLEVBQUU7SUFDckIsV0FBVyxFQUFFLG1CQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQztDQUMxRCxDQUFDO0FBRUYsSUFBSSwrQ0FBcUIsQ0FBQyxHQUFHLEVBQUUsdUJBQXVCLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsZ0ZBQWdGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW50ZXJhY3Rpb25zQnVsa1N0YWNrIH0gZnJvbSAnLi4vbGliL2ludGVyYWN0aW9uc19idWxrLXN0YWNrJztcbmltcG9ydCB7IGNvbmZpZyB9IGZyb20gJ2RvdGVudic7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnOyAvLyBTT05BUi1FWEM6IEVzdGEgaW1wb3J0YWNpw7NuIGVzIG5hdGl2YSBkZSBOT0RFIHBvciBsbyBxdWUgbm8gZXMgbmVjZXNhcmlvIGFncmVnYXJsYSBjb21vIGRlcGVuZGVuY2lhLlxuaW1wb3J0IHsgS0FwaVN0YWNrLCBLQXBpU3RhY2tQcm9wcyB9IGZyb20gJ0BrYWNlL2F3cy1pbmZyYS9zcmMvS0FwaVN0YWNrJztcbmltcG9ydCB7IEFwcCB9IGZyb20gJ2F3cy1jZGstbGliJztcblxuY29uZmlnKHsgcGF0aDogJy4uLy4uLy4uLy5lbnYnIH0pO1xuXG5jb25zdCBhcHAgPSBuZXcgQXBwKCk7XG5jb25zdCBwcm9wcyA9IHtcbiAgICBlbnY6IHtcbiAgICAgICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgICAgICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04sXG4gICAgfSxcbn07XG5cbmNvbnN0IGtQcm9wczogS0FwaVN0YWNrUHJvcHMgPSB7XG4gICAgLi4uS0FwaVN0YWNrLktQcm9wcygpLFxuICAgIHBhdGhIYW5kbGVyOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL2hhbmRsZXIubWpzJyksXG59O1xuXG5uZXcgSW50ZXJhY3Rpb25zQnVsa1N0YWNrKGFwcCwgJ0ludGVyYWN0aW9uc0J1bGtTdGFjaycsIHByb3BzLCBrUHJvcHMpOyAvLyBTT05BUi1FWEM6IEVzdGEgaW5zdGFuY2lhIGVzIG5lY2VzYXJpYSBwYXJhIGluaWNpYWxpemFyIHJlY3Vyc29zIGVuIGVsIHN0YWNrLlxuIl19
