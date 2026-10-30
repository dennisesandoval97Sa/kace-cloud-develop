import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { CfnOutput, Duration, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { AttributeType, BillingMode, ITable, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class TenantStack extends KApiStack {
    private tenantTable: ITable;

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        this.tenantTable = this.createOrImportTenantConfigurationTable();

        new CfnOutput(this, 'OutputTableArn', {
            description: 'Tenant Configuration Table ARN',
            value: this.tenantTable.tableArn,
        });

        this.setDefaultOptions('tenant');
    }

    private createOrImportTenantConfigurationTable(): ITable {
        if (this.config.awsDynamoDbMultitenantTableARN) {
            return Table.fromTableArn(this, 'TenantConfigurationTable', this.config.awsDynamoDbMultitenantTableARN);
        }

        return new Table(this, 'TenantConfigurationTable', {
            tableName: `${this.config.appsServiceName}_kace_multi_tenancy`,
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.DEFAULT,
            removalPolicy: this.isStagingOrProduction() ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
            deletionProtection: this.isStagingOrProduction(),
        });
    }

    public grantDynamoDbPermissions(_id: string, lambdaFunction: NodejsFunction) {
        this.tenantTable.grantFullAccess(lambdaFunction);
    }

    public nodejsFunctionDefaultProps(): NodejsFunctionProps {
        let props = {};
        if (this.isStagingOrProduction() && this.vpc && this.lambdaSG) {
            props = {
                vpc: this.vpc,
                vpcSubnets: {
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
                securityGroups: [this.lambdaSG],
            };
        }

        return {
            bundling: {
                nodeModules: ['pg', 'knex', 'uuid', 'bcrypt', 'dayjs', 'jsonwebtoken'],
                forceDockerBundling: true,
            },
            timeout: Duration.seconds(30),
            environment: {
                NODE_ENV: this.config.environment,
                API_VERSION: KApiStack.getApiVersion(),
                TARGET_DYNAMODB_TABLE: `${this.config.appsServiceName}_kace_multi_tenancy`,
                TARGET_DYNAMODB_REGION: this.config.awsCognitoRegion,
                ...this.nodejsFunctionAppEnvVar(),
            },
            runtime: Runtime.NODEJS_22_X,
            memorySize: 256,
            ...props,
        };
    }
}
