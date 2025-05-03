#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { SpringCdkTemplateStack } from "../lib/spring_cdk_template-stack";
import { devProps, prodProps } from "../config";

const app = new cdk.App();
const envConfigs = [devProps, prodProps];
envConfigs.forEach((envConfig) => {
  if (!envConfig.shouldDeploy) {
    return;
  }
  const stackName = `${envConfig.stackName}-stack`;
  console.log(`Creating stack: ${stackName}`);
  new SpringCdkTemplateStack(app, stackName, {
    ...envConfig,
    env: {
      account: envConfig.account,
      region: envConfig.region,
    },
    description: `Stack ${envConfig.stackName}`,
  });
});

app.synth();
