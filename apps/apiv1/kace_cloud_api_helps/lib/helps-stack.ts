import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';

export class HelpsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        this.setDefaultOptions('helps');
    }
}
