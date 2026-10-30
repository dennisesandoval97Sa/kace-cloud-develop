'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
const dotenv_1 = require('dotenv');
const node_path_1 = __importDefault(require('node:path')); // SONAR-EXC: Esta importación es nativa de NODE por lo que no es necesario agregarla como dependencia.
const KApiStack_1 = require('@kace/aws-infra/src/KApiStack');
const aws_cdk_lib_1 = require('aws-cdk-lib');
const interactions_stack_1 = require('../lib/interactions-stack');
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
new interactions_stack_1.InteractionsStack(app, 'InteractionsStack', props, kProps); // SONAR-EXC: Esta instancia es necesaria para inicializar recursos en el stack.
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3Rpb25zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaW50ZXJhY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUNBQWdDO0FBQ2hDLDBEQUE2QixDQUFDLHVHQUF1RztBQUNySSw2REFBMEU7QUFDMUUsNkNBQWtDO0FBQ2xDLGtFQUE4RDtBQUU5RCxJQUFBLGVBQU0sRUFBQyxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0FBRWxDLE1BQU0sR0FBRyxHQUFHLElBQUksaUJBQUcsRUFBRSxDQUFDO0FBQ3RCLE1BQU0sS0FBSyxHQUFHO0lBQ1YsR0FBRyxFQUFFO1FBQ0QsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQjtLQUN6QztDQUNKLENBQUM7QUFDRixNQUFNLE1BQU0sR0FBbUI7SUFDM0IsR0FBRyxxQkFBUyxDQUFDLE1BQU0sRUFBRTtJQUNyQixXQUFXLEVBQUUsbUJBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDO0NBQzFELENBQUM7QUFDRixJQUFJLHNDQUFpQixDQUFDLEdBQUcsRUFBRSxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxnRkFBZ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjb25maWcgfSBmcm9tICdkb3RlbnYnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJzsgLy8gU09OQVItRVhDOiBFc3RhIGltcG9ydGFjacOzbiBlcyBuYXRpdmEgZGUgTk9ERSBwb3IgbG8gcXVlIG5vIGVzIG5lY2VzYXJpbyBhZ3JlZ2FybGEgY29tbyBkZXBlbmRlbmNpYS5cbmltcG9ydCB7IEtBcGlTdGFjaywgS0FwaVN0YWNrUHJvcHMgfSBmcm9tICdAa2FjZS9hd3MtaW5mcmEvc3JjL0tBcGlTdGFjayc7XG5pbXBvcnQgeyBBcHAgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBJbnRlcmFjdGlvbnNTdGFjayB9IGZyb20gJy4uL2xpYi9pbnRlcmFjdGlvbnMtc3RhY2snO1xuXG5jb25maWcoeyBwYXRoOiAnLi4vLi4vLi4vLmVudicgfSk7XG5cbmNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcbmNvbnN0IHByb3BzID0ge1xuICAgIGVudjoge1xuICAgICAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgICAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTixcbiAgICB9LFxufTtcbmNvbnN0IGtQcm9wczogS0FwaVN0YWNrUHJvcHMgPSB7XG4gICAgLi4uS0FwaVN0YWNrLktQcm9wcygpLFxuICAgIHBhdGhIYW5kbGVyOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL2hhbmRsZXIubWpzJyksXG59O1xubmV3IEludGVyYWN0aW9uc1N0YWNrKGFwcCwgJ0ludGVyYWN0aW9uc1N0YWNrJywgcHJvcHMsIGtQcm9wcyk7IC8vIFNPTkFSLUVYQzogRXN0YSBpbnN0YW5jaWEgZXMgbmVjZXNhcmlhIHBhcmEgaW5pY2lhbGl6YXIgcmVjdXJzb3MgZW4gZWwgc3RhY2suXG4iXX0=
