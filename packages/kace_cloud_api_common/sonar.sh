#!/bin/bash

module=$(basename "$PWD")
version=$(jq -r '.version' package.json)
read -s -p "Enter SonarQube token: " sonarToken

docker run --rm \
    -e SONAR_HOST_URL="http://172.20.73.175:9000/" \
    -e SONAR_LOGIN="$sonarToken" \
    -v "${PWD}:/usr/src" \
    -u $(id -u):$(id -g) \
    sonarsource/sonar-scanner-cli:11.1 \
    -X \
    -Dsonar.login="$sonarToken" \
    -Dsonar.projectVersion=1.0 \
    -Dsonar.projectKey=KCRM_KACE_CLOUD_${module}_${version} \
    -Dsonar.projectName=KCRM_KACE_CLOUD_${module}_${version} \
    -Dsonar.sourceEncoding=UTF-8 \
    -Dsonar.exclusions=cdk.out/**,node_modules/**,tests/**