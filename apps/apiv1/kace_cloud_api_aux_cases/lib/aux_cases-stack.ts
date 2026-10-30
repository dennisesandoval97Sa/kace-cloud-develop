import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class AuxCasesStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        this.setDefaultOptions('aux-cases');
    }

    nodejsFunctionDefaultProps(): NodejsFunctionProps {
        const props = super.nodejsFunctionDefaultProps();
        return {
            ...props,
            memorySize: 512,
        };
    }
}
