import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"
import {DeploymentKaceAdminFrontService} from "./deployment-kace-admin-front-service"

export class KaceAdminStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props)

		new DeploymentKaceAdminFrontService(this, "deployment")
		// SONAR-EXC: Esta instancia es necesaria para inicializar recursos en el stack.

		cdk.Tags.of(this).add("Proyecto", "kace");
		cdk.Tags.of(this).add("Entorno", "dev");
		cdk.Tags.of(this).add("CuentaClie", "konecta");
	}
}
