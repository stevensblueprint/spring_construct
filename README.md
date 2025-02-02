# Spring Boot + Postgres CDK Template
Deploy a Spring Boot + Postgres application to AWS. 

## Deployment
Create an `ECR` repository to push the Docker images
```bash
aws ecr create-repository --repository-name {project_name} --image-scanning-configuration scanOnPush=true --region {region}
```

Fill out the configuration file under `config/config.yaml`. 
Add your `sql` scripts to initialize the db (add tables, and sample data) under `db_scripts/*.sql`.
Run `cdk deploy`.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
