import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsp from "aws-cdk-lib/aws-ecs-patterns";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import path = require("path");

interface SpringCdkTemplateStackProps extends cdk.StackProps {
  stackName: string;
  vpcName: string;
  pgSecurityGroup: string;
  dbName: string;
  ecrRepository: string;
}
export class SpringCdkTemplateStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: SpringCdkTemplateStackProps
  ) {
    super(scope, id, props);

    const repository = ecr.Repository.fromRepositoryName(
      this,
      `Repository-${props.stackName}`,
      props.ecrRepository
    );

    const scriptsBucket = new s3.Bucket(this, "DatabaseScriptsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new s3deploy.BucketDeployment(this, "DeployScripts", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../scripts"))],
      destinationBucket: scriptsBucket,
    });

    const vpc = new ec2.Vpc(this, props.vpcName, {
      maxAzs: 2,
      natGateways: 1,
    });

    const pgSecurityGroup = new ec2.SecurityGroup(this, props.pgSecurityGroup, {
      vpc,
      description: "Security group for PostgreSQL server",
      allowAllOutbound: true,
    });

    pgSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      "Allow inbound traffic from VPC"
    );

    const pgDBcreds = new secretsmanager.Secret(
      this,
      `pgCres${props.stackName}`,
      {
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ usernmae: "postgres" }),
          generateStringKey: "password",
          excludeCharacters: '"@/\\',
        },
      }
    );

    const pgInstance = new ec2.Instance(this, `DB-${props.stackName}`, {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: pgSecurityGroup,
    });

    pgInstance.userData.addCommands(
      "yum update -y",
      "yum install -y postgresql postgresql-server postgresql-contrib aws-cli",
      "postgresql-setup initdb",

      "sed -i \"s/#listen_addresses = 'localhost'/listen_addresses = '*'/\" /var/lib/pgsql/data/postgresql.conf",
      'sed -i "s/ident/md5/g" /var/lib/pgsql/data/pg_hba.conf',

      "systemctl start postgresql",
      "systemctl enable postgresql",

      `aws s3 cp s3://${scriptsBucket.bucketName}/ /tmp/db-scripts --recursive`,
      "chmod +x /tmp/db-scripts/*.sql",

      `export PGPASSWORD=$(aws secretsmanager get-secret-value --secret-id ${pgDBcreds.secretArn} --query SecretString --output text | jq -r .password)`,

      "for script in /tmp/db-scripts/*.sql; do",
      '  psql -U postgres -d postgres -f "$script"',
      "done"
    );

    const cluster = new ecs.Cluster(this, `Cluster-${props.stackName}`, {
      vpc,
      enableFargateCapacityProviders: true,
    });

    const image = ecs.ContainerImage.fromEcrRepository(repository, "latest");

    const sbService = new ecsp.ApplicationLoadBalancedFargateService(
      this,
      `Service-${props.stackName}`,
      {
        cluster,
        memoryLimitMiB: 512,
        cpu: 256,
        desiredCount: 1,
        taskImageOptions: {
          image: image,
          environment: {
            SPRING_DATASOURCE_URL: `jdbc:postgresql://${pgInstance.instancePrivateDnsName}:5432/${props.dbName}`,
            SPRING_DATASOURCE_USERNAME: "postgres",
          },
          secrets: {
            SPRING_DATASOURCE_PASSWORD:
              ecs.Secret.fromSecretsManager(pgDBcreds),
          },
        },
        capacityProviderStrategies: [
          {
            capacityProvider: "FARGATE_SPOT",
            weight: 1,
          },
        ],
        deploymentController: {
          type: ecs.DeploymentControllerType.ECS,
        },
        circuitBreaker: { rollback: true },
      }
    );

    repository.grantPull(sbService.taskDefinition.executionRole!);

    sbService.service.connections.allowTo(
      pgInstance,
      ec2.Port.tcp(5432),
      "Allow traffic to PostgreSQL"
    );

    pgInstance.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite")
    );
    scriptsBucket.grantRead(pgInstance.role);

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: sbService.loadBalancer.loadBalancerDnsName,
    });

    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: repository.repositoryUri,
    });
  }
}
