import { join } from "path";
import { readFileSync } from "fs";
import { parse } from "yaml";

const configFilePath = join(__dirname, "config.yaml");
const readConfigFile = readFileSync(configFilePath, "utf8");
const config = parse(readConfigFile);

function getEnvironmentConfig(environmentName: string) {
  const environment = config[environmentName];
  return {
    shouldDeploy: environment.shouldDeploy,
    stackName: environment.stackName,
    vpcName: environment.vpcName,
    pgSecurityGroup: environment.pgSecurityGroup,
    dbName: environment.dbName,
    ecrRepository: environment.ecrRepository,
    keyName: environment.keyName,
    region: environment.region,
    githubOwner: environment.githubOwner,
    githubRepo: environment.githubRepo,
    githubBranch: environment.githubBranch,
    githubAccessTokenSecret: environment.githubAccessTokenSecret,
    pipelineContainerName: environment.pipelineContainerName,
    pipelineName: environment.pipelineName,
    domainName: environment.domainName,
    subdomainName: environment.subdomainName,
    certificateArn: environment.certificateArn,
  };
}

export const devProps = getEnvironmentConfig("dev");
export const prodProps = getEnvironmentConfig("prod");
