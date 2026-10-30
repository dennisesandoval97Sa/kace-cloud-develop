'use strict';
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              var desc = Object.getOwnPropertyDescriptor(m, k);
              if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k];
                      },
                  };
              }
              Object.defineProperty(o, k2, desc);
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              o[k2] = m[k];
          });
var __setModuleDefault =
    (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
              Object.defineProperty(o, 'default', { enumerable: true, value: v });
          }
        : function (o, v) {
              o['default'] = v;
          });
var __importStar =
    (this && this.__importStar) ||
    function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.OrchestratorHelper = void 0;
const aws_cdk_lib_1 = require('aws-cdk-lib');
const aws_lambda_nodejs_1 = require('aws-cdk-lib/aws-lambda-nodejs');
const aws_lambda_1 = require('aws-cdk-lib/aws-lambda');
const aws_iam_1 = require('aws-cdk-lib/aws-iam');
const path = __importStar(require('path'));
/**
 * Helper para crear EventBridge Orchestrator Lambda
 *
 * Crea un Lambda que:
 * 1. Consulta todos los tenants de DynamoDB
 * 2. Invoca el target Lambda para cada tenant
 *
 * @example
 * ```typescript
 * const orchestrator = OrchestratorHelper.createOrchestrator({
 *     endpoint: 'actions-queue-executions',
 *     targetLambdaArn: lambdaFunction.functionArn,
 *     scope: this,
 *     suffix: this.node.addr,
 * });
 *
 * // Usar con EventBridge
 * scheduleRule.addTarget(new LambdaFunction(orchestrator));
 * ```
 */
class OrchestratorHelper {
    /**
     * Crea un Lambda orchestrator para multi-tenant scheduled events
     */
    static createOrchestrator(config) {
        const { endpoint, targetLambdaArn, scope, suffix, timeoutMinutes = 10, memorySize = 512 } = config;
        // Crear Lambda orchestrator
        const functionName = suffix ? `${suffix}${endpoint}-orch` : `${endpoint}-orch`;
        const orchestratorFunction = new aws_lambda_nodejs_1.NodejsFunction(scope, `${endpoint}OrchestratorFunction`, {
            functionName,
            entry: path.join(__dirname, '../../../kace_cloud_api_common/src/handlers/eventbridge-orchestrator.mjs'),
            runtime: aws_lambda_1.Runtime.NODEJS_22_X,
            timeout: aws_cdk_lib_1.Duration.minutes(timeoutMinutes),
            memorySize,
            environment: {
                TARGET_LAMBDA_ARN: targetLambdaArn,
                NODE_OPTIONS: '--enable-source-maps',
                TARGET_DYNAMODB_TABLE: `${suffix}_kace_multi_tenancy`,
            },
            bundling: {
                minify: false,
                sourceMap: true,
                externalModules: ['@aws-sdk/*'],
                nodeModules: ['pg', 'knex', 'uuid', 'bcrypt', 'dayjs', 'jsonwebtoken'],
                forceDockerBundling: true,
            },
        });
        // Permiso para invocar target Lambda
        orchestratorFunction.addToRolePolicy(
            new aws_iam_1.PolicyStatement({
                effect: aws_iam_1.Effect.ALLOW,
                actions: ['lambda:InvokeFunction'],
                resources: [targetLambdaArn],
            })
        );
        // Permiso para leer tenants de DynamoDB
        orchestratorFunction.addToRolePolicy(
            new aws_iam_1.PolicyStatement({
                effect: aws_iam_1.Effect.ALLOW,
                actions: ['dynamodb:Scan', 'dynamodb:GetItem'],
                resources: [`arn:aws:dynamodb:*:*:table/${suffix}_kace_multi_tenancy`],
            })
        );
        return orchestratorFunction;
    }
}
exports.OrchestratorHelper = OrchestratorHelper;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3JjaGVzdHJhdG9ySGVscGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiT3JjaGVzdHJhdG9ySGVscGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNkNBQXVDO0FBQ3ZDLHFFQUErRDtBQUMvRCx1REFBaUQ7QUFDakQsaURBQThEO0FBRTlELDJDQUE2QjtBQWlCN0I7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7QUFDSCxNQUFhLGtCQUFrQjtJQUMzQjs7T0FFRztJQUNILE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxNQUEwQjtRQUNoRCxNQUFNLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLGNBQWMsR0FBRyxFQUFFLEVBQUUsVUFBVSxHQUFHLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQztRQUVuRyw0QkFBNEI7UUFDNUIsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sR0FBRyxRQUFRLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLE9BQU8sQ0FBQztRQUMvRSxNQUFNLG9CQUFvQixHQUFHLElBQUksa0NBQWMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxRQUFRLHNCQUFzQixFQUFFO1lBQ3RGLFlBQVk7WUFDWixLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FDWixTQUFTLEVBQ1QsMEVBQTBFLENBQzdFO1lBQ0QsT0FBTyxFQUFFLG9CQUFPLENBQUMsV0FBVztZQUM1QixPQUFPLEVBQUUsc0JBQVEsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDO1lBQ3pDLFVBQVU7WUFDVixXQUFXLEVBQUU7Z0JBQ1QsaUJBQWlCLEVBQUUsZUFBZTtnQkFDbEMsWUFBWSxFQUFFLHNCQUFzQjtnQkFDcEMscUJBQXFCLEVBQUUsR0FBRyxNQUFNLHFCQUFxQjthQUN4RDtZQUNELFFBQVEsRUFBRTtnQkFDTixNQUFNLEVBQUUsS0FBSztnQkFDYixTQUFTLEVBQUUsSUFBSTtnQkFDZixlQUFlLEVBQUUsQ0FBQyxZQUFZLENBQUM7Z0JBQy9CLFdBQVcsRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsY0FBYyxDQUFDO2dCQUN0RSxtQkFBbUIsRUFBRSxJQUFJO2FBQzVCO1NBQ0osQ0FBQyxDQUFDO1FBRUgscUNBQXFDO1FBQ3JDLG9CQUFvQixDQUFDLGVBQWUsQ0FDaEMsSUFBSSx5QkFBZSxDQUFDO1lBQ2hCLE1BQU0sRUFBRSxnQkFBTSxDQUFDLEtBQUs7WUFDcEIsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUM7WUFDbEMsU0FBUyxFQUFFLENBQUMsZUFBZSxDQUFDO1NBQy9CLENBQUMsQ0FDTCxDQUFDO1FBRUYsd0NBQXdDO1FBQ3hDLG9CQUFvQixDQUFDLGVBQWUsQ0FDaEMsSUFBSSx5QkFBZSxDQUFDO1lBQ2hCLE1BQU0sRUFBRSxnQkFBTSxDQUFDLEtBQUs7WUFDcEIsT0FBTyxFQUFFLENBQUMsZUFBZSxFQUFFLGtCQUFrQixDQUFDO1lBQzlDLFNBQVMsRUFBRSxDQUFDLDhCQUE4QixNQUFNLHFCQUFxQixDQUFDO1NBQ3pFLENBQUMsQ0FDTCxDQUFDO1FBRUYsT0FBTyxvQkFBb0IsQ0FBQztJQUNoQyxDQUFDO0NBQ0o7QUFwREQsZ0RBb0RDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRHVyYXRpb24gfSBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xyXG5pbXBvcnQgeyBSdW50aW1lIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCB7IFBvbGljeVN0YXRlbWVudCwgRWZmZWN0IH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBPcmNoZXN0cmF0b3JDb25maWcge1xyXG4gICAgLyoqIE5vbWJyZSBkZWwgZW5kcG9pbnQgKGVqOiAnYWN0aW9ucy1xdWV1ZS1leGVjdXRpb25zJykgKi9cclxuICAgIGVuZHBvaW50OiBzdHJpbmc7XHJcbiAgICAvKiogQVJOIGRlbCBMYW1iZGEgdGFyZ2V0IGEgaW52b2NhciBwb3IgY2FkYSB0ZW5hbnQgKi9cclxuICAgIHRhcmdldExhbWJkYUFybjogc3RyaW5nO1xyXG4gICAgLyoqIENESyBDb25zdHJ1Y3QgcGFkcmUgKi9cclxuICAgIHNjb3BlOiBDb25zdHJ1Y3Q7XHJcbiAgICAvKiogU3VmaWpvIMO6bmljbyBwYXJhIGVsIG5vbWJyZSBkZWwgTGFtYmRhIChvcGNpb25hbCkgKi9cclxuICAgIHN1ZmZpeD86IHN0cmluZztcclxuICAgIC8qKiBUaW1lb3V0IGVuIG1pbnV0b3MgKGRlZmF1bHQ6IDEwKSAqL1xyXG4gICAgdGltZW91dE1pbnV0ZXM/OiBudW1iZXI7XHJcbiAgICAvKiogTWVtb3J5IGVuIE1CIChkZWZhdWx0OiA1MTIpICovXHJcbiAgICBtZW1vcnlTaXplPzogbnVtYmVyO1xyXG59XHJcblxyXG4vKipcclxuICogSGVscGVyIHBhcmEgY3JlYXIgRXZlbnRCcmlkZ2UgT3JjaGVzdHJhdG9yIExhbWJkYVxyXG4gKlxyXG4gKiBDcmVhIHVuIExhbWJkYSBxdWU6XHJcbiAqIDEuIENvbnN1bHRhIHRvZG9zIGxvcyB0ZW5hbnRzIGRlIER5bmFtb0RCXHJcbiAqIDIuIEludm9jYSBlbCB0YXJnZXQgTGFtYmRhIHBhcmEgY2FkYSB0ZW5hbnRcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBgdHlwZXNjcmlwdFxyXG4gKiBjb25zdCBvcmNoZXN0cmF0b3IgPSBPcmNoZXN0cmF0b3JIZWxwZXIuY3JlYXRlT3JjaGVzdHJhdG9yKHtcclxuICogICAgIGVuZHBvaW50OiAnYWN0aW9ucy1xdWV1ZS1leGVjdXRpb25zJyxcclxuICogICAgIHRhcmdldExhbWJkYUFybjogbGFtYmRhRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXHJcbiAqICAgICBzY29wZTogdGhpcyxcclxuICogICAgIHN1ZmZpeDogdGhpcy5ub2RlLmFkZHIsXHJcbiAqIH0pO1xyXG4gKlxyXG4gKiAvLyBVc2FyIGNvbiBFdmVudEJyaWRnZVxyXG4gKiBzY2hlZHVsZVJ1bGUuYWRkVGFyZ2V0KG5ldyBMYW1iZGFGdW5jdGlvbihvcmNoZXN0cmF0b3IpKTtcclxuICogYGBgXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgT3JjaGVzdHJhdG9ySGVscGVyIHtcclxuICAgIC8qKlxyXG4gICAgICogQ3JlYSB1biBMYW1iZGEgb3JjaGVzdHJhdG9yIHBhcmEgbXVsdGktdGVuYW50IHNjaGVkdWxlZCBldmVudHNcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGNyZWF0ZU9yY2hlc3RyYXRvcihjb25maWc6IE9yY2hlc3RyYXRvckNvbmZpZyk6IE5vZGVqc0Z1bmN0aW9uIHtcclxuICAgICAgICBjb25zdCB7IGVuZHBvaW50LCB0YXJnZXRMYW1iZGFBcm4sIHNjb3BlLCBzdWZmaXgsIHRpbWVvdXRNaW51dGVzID0gMTAsIG1lbW9yeVNpemUgPSA1MTIgfSA9IGNvbmZpZztcclxuXHJcbiAgICAgICAgLy8gQ3JlYXIgTGFtYmRhIG9yY2hlc3RyYXRvclxyXG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IHN1ZmZpeCA/IGAke3N1ZmZpeH0ke2VuZHBvaW50fS1vcmNoYCA6IGAke2VuZHBvaW50fS1vcmNoYDtcclxuICAgICAgICBjb25zdCBvcmNoZXN0cmF0b3JGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzY29wZSwgYCR7ZW5kcG9pbnR9T3JjaGVzdHJhdG9yRnVuY3Rpb25gLCB7XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uTmFtZSxcclxuICAgICAgICAgICAgZW50cnk6IHBhdGguam9pbihcclxuICAgICAgICAgICAgICAgIF9fZGlybmFtZSxcclxuICAgICAgICAgICAgICAgICcuLi8uLi8uLi9rYWNlX2Nsb3VkX2FwaV9jb21tb24vc3JjL2hhbmRsZXJzL2V2ZW50YnJpZGdlLW9yY2hlc3RyYXRvci5tanMnXHJcbiAgICAgICAgICAgICksXHJcbiAgICAgICAgICAgIHJ1bnRpbWU6IFJ1bnRpbWUuTk9ERUpTXzIyX1gsXHJcbiAgICAgICAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXModGltZW91dE1pbnV0ZXMpLFxyXG4gICAgICAgICAgICBtZW1vcnlTaXplLFxyXG4gICAgICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgICAgICAgVEFSR0VUX0xBTUJEQV9BUk46IHRhcmdldExhbWJkYUFybixcclxuICAgICAgICAgICAgICAgIE5PREVfT1BUSU9OUzogJy0tZW5hYmxlLXNvdXJjZS1tYXBzJyxcclxuICAgICAgICAgICAgICAgIFRBUkdFVF9EWU5BTU9EQl9UQUJMRTogYCR7c3VmZml4fV9rYWNlX211bHRpX3RlbmFuY3lgLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBidW5kbGluZzoge1xyXG4gICAgICAgICAgICAgICAgbWluaWZ5OiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGV4dGVybmFsTW9kdWxlczogWydAYXdzLXNkay8qJ10sXHJcbiAgICAgICAgICAgICAgICBub2RlTW9kdWxlczogWydwZycsICdrbmV4JywgJ3V1aWQnLCAnYmNyeXB0JywgJ2RheWpzJywgJ2pzb253ZWJ0b2tlbiddLFxyXG4gICAgICAgICAgICAgICAgZm9yY2VEb2NrZXJCdW5kbGluZzogdHJ1ZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gUGVybWlzbyBwYXJhIGludm9jYXIgdGFyZ2V0IExhbWJkYVxyXG4gICAgICAgIG9yY2hlc3RyYXRvckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPVyxcclxuICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnbGFtYmRhOkludm9rZUZ1bmN0aW9uJ10sXHJcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFt0YXJnZXRMYW1iZGFBcm5dLFxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIC8vIFBlcm1pc28gcGFyYSBsZWVyIHRlbmFudHMgZGUgRHluYW1vREJcclxuICAgICAgICBvcmNoZXN0cmF0b3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbJ2R5bmFtb2RiOlNjYW4nLCAnZHluYW1vZGI6R2V0SXRlbSddLFxyXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6ZHluYW1vZGI6KjoqOnRhYmxlLyR7c3VmZml4fV9rYWNlX211bHRpX3RlbmFuY3lgXSxcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICByZXR1cm4gb3JjaGVzdHJhdG9yRnVuY3Rpb247XHJcbiAgICB9XHJcbn1cclxuIl19
