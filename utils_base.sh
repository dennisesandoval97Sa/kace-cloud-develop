#!/bin/bash

# shellcheck disable=SC2154
export logFilename="utils.log"
log_info() {
  echo "$(date +"%Y%m%d_%H%M%S")::INFO $1" | tee -a "$workingDirectory/$logFilename"
}
export -f log_info

log_error() {
  echo "$(date +"%Y%m%d_%H%M%S")::ERROR $1" | tee -a "$workingDirectory/$logFilename"
}
export -f log_error

export logVersionsFilename="versions.txt"
log_version() {
  echo "$1" | tee -a "$workingDirectory/$logVersionsFilename"
}
export -f log_version

installRepository(){
  log_info "$1 Installing repository"
  if [ -d "$destinationDirectory/$1" ]; then
    log_error "$1 Repository already exists"
    exit 0;
  fi

  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching to develop branch"
  if ! cd "$destinationDirectory/$1" || ! git checkout develop; then
    log_error "$1 Failed to switch to the develop branch"
    exit 1
  fi

  log_info "$1 Repository installed"
}
export -f installRepository

installPackages(){
  log_info "$1 Installing package"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  if ! git pull; then
    log_error "$1 Failed to pull develop branch"
    exit 1
  fi

  if ! npm install; then
    log_error "$1 Failed to install package"
    exit 1
  fi

  log_info "$1 Packages installed"
}
export -f installPackages

checkPendingChanges(){
  if ! cd "$destinationDirectory/$1"; then
      log_error "$1 Failed to switch to the package"
      exit 1
  fi

  if [ -n "$(git status --porcelain)" ]; then
    log_error "$1 There are changes pending to commit"
    exit 1
  fi

  if [ -n "$(git cherry -v)" ]; then
    log_error "$1 There are changes pending to push"
    exit 1
  fi
}
export -f checkPendingChanges

updateKaceInternalPackages(){
  source .env

  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Updating Kace internal packages"
  if ! cd "$destinationDirectory/$1"; then
      log_error "$1 Failed to switch to the package"
      exit 1
  fi

  log_info "$1 switch to develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to checkout develop branch"
    exit 1
  fi

  packageAwsInfra="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_aws_infra.git#$NPM_KACE_CLOUD_AWS_INFRA"
  packageApiCommon="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_api_common.git#$NPM_KACE_CLOUD_API_COMMON"
  packageCore="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_core.git#$NPM_KACE_CLOUD_CORE"
  packageDatabase="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_database.git#$NPM_KACE_CLOUD_DATABASE"
  packagePrettier="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_prettier_config_shared.git#$NPM_KACE_CLOUD_PRETTIER_CONFIG_SHARED"
  log_info "$1 Installing all packages"
  npm install $packageAwsInfra $packageApiCommon $packageCore $packageDatabase $packagePrettier
  if [[ $? -gt 0 ]]; then
    log_error "$1 Failed to install all packages"
    exit 1
  fi

  log_info "$1 deleting package-lock.json in .gitignore"
  if ! sed -i '/package-lock.json/d' .gitignore; then
    log_error "$1 Failed to delete package-lock.json"
    exit 1
  fi

  if ! git add package.json package-lock.json .gitignore; then
    log_error "$1 Failed to add package.json"
    exit 1
  fi

  if [ -n "$(git status --porcelain)" ]; then
    log_info "$1 Preparing to commit"
    message="Update kace internal packages
kace_cloud_aws_infra:$NPM_KACE_CLOUD_AWS_INFRA
kace_cloud_api_common:$NPM_KACE_CLOUD_API_COMMON
kace_cloud_core:$NPM_KACE_CLOUD_CORE
kace_cloud_database:$NPM_KACE_CLOUD_DATABASE
kace_cloud_prettier_config_shared:$NPM_KACE_CLOUD_PRETTIER_CONFIG_SHARED"
    if ! git commit -m "$message"; then
      log_error "$1 Failed to commit"
      exit 1
    fi

    log_info "$1 Pushing to develop branch"
    if ! git push origin develop; then
      log_error "$1 Failed to push"
      exit 1
    fi
  fi
}
export -f updateKaceInternalPackages

resetAndCleanBranch(){
  if ! cd "$destinationDirectory/$1"; then
      log_error "$1 Failed to switch to the package"
      exit 1
  fi

  if ! git reset --hard; then
    log_error "$1 Failed to reset branch"
    exit 1
  fi

  if ! git clean -f -d; then
    log_error "$1 Failed to clean branch"
    exit 1
  fi
}
export -f resetAndCleanBranch

deployApisDevEnvironment(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to checkout develop branch"
    exit 1
  fi

  log_info "$1 Installing packages"
  if ! npm ci ; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 Deploying"
  if ! npx cdk deploy --require-approval never ; then
    log_error "$1 Failed to deploy"
    exit 1
  fi
}
export -f deployApisDevEnvironment

getGitTags(){
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Obteniendo lista de tags"
  if ! git fetch --tags origin; then
    log_error "$1 Error al actualizar la lista de tags"
    exit 1
  fi

  log_info "$1 Lista de tags"
  git for-each-ref --sort=taggerdate --format '%(refname:short)' refs/tags
}
export -f getGitTags

getLastCommit(){
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  if ! git pull > /dev/null 2>&1; then
    log_error "$1 Failed to pull branch"
    exit 1
  fi

  message=$(git log -1)
  log_info "$1 Obteniendo último $message"
}
export -f getLastCommit

destroyDevEnvironment(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to checkout develop branch"
    exit 1
  fi

  log_info "$1 Pulling develop branch"
  if ! git pull; then
    log_error "$1 Failed to pull develop branch"
    exit 1
  fi

  log_info "$1 Installing packages"
  if ! npm install; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 Destroying"
  if ! cdk destroy --force; then
    log_error "$1 Failed to destroy"
    exit 1
  fi
}
export -f destroyDevEnvironment

deployProdEnvironment(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out $2"
  if ! git checkout $2; then
    log_error "$1 Failed to checkout $2 branch"
    exit 1
  fi

  log_info "$1 Installing packages"
  if ! npm install; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 Deploying"
  if ! cdk deploy --require-approval never; then
    log_error "$1 Failed to deploy"
    exit 1
  fi
}
export -f deployProdEnvironment

deployFrontendProdEnvironment(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out $2"
  if ! git checkout $2; then
    log_error "$1 Failed to checkout develop branch"
    exit 1
  fi

  log_info "$1 Installing packages"
  if ! pnpm install; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 Deploying"
  if ! pnpm run cdk-deploy2; then
    log_error "$1 Failed to deploy"
    exit 1
  fi
}
export -f deployFrontendProdEnvironment

destroyProdEnvironment(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out $2 branch"
  if ! git checkout $2; then
    log_error "$1 Failed to checkout $2 branch"
    exit 1
  fi

  log_info "$1 Installing packages"
  if ! npm install; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 Destroying"
  if ! cdk destroy --force; then
    log_error "$1 Failed to destroy"
    exit 1
  fi
}
export -f destroyProdEnvironment

getLastCommitHash(){
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  if [ "$(git rev-parse --abbrev-ref HEAD)" != "develop" ]; then
    log_error "$1 Not in develop branch"
    exit 1
  fi

  if ! git pull > /dev/null 2>&1; then
    log_error "$1 Failed to pull branch"
    exit 1
  fi

  message=$(git log -1 --pretty=format:"%H")
  echo "$1 $message"
}
export -f getLastCommitHash

updateReleaseBranch(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Switching to develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to switch to the develop branch"
    exit 1
  fi

  log_info "$1 switch to release branch"
  if ! git checkout release/$2; then
    log_error "$1 Failed to switch to release branch"
    exit 1
  fi

  log_info "$1 merge develop branch"
  if ! git merge --no-ff develop -m "Merge develop into release/$2"; then
    log_error "$1 Failed to merge develop branch"
    exit 1
  fi

  if ! git push origin release/$2; then
    log_error "$1 Failed to push changes"
    exit 1
  fi

  log_version "$1:$(git log -1 --pretty=format:"%H")"
}
export -f updateReleaseBranch

deployFrontDevEnvironment(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Copy dotenv file"
  if ! cp ../../../.env .env; then
    log_error "$1 Failed to copy dotenv file"
    exit 1
  fi

  log_info "$1 Checking out develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to checkout develop branch"
    exit 1
  fi

  log_info "$1 Installing packages"
  if ! npm ci ; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 Deploying"
  if ! npm run cdk-deploy2; then
    log_error "$1 Failed to deploy"
    exit 1
  fi
}
export -f deployFrontDevEnvironment

deployFrontEnvironmentByBranch(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Copy dotenv file"
  if ! cp ../../../.env .env; then
    log_error "$1 Failed to copy dotenv file"
    exit 1
  fi

  log_info "$1 Checking out $kaceBranchOrTag"
  if ! git checkout $kaceBranchOrTag; then
    log_info "$1 No se encontró la rama, intentando como tag"
    if ! git checkout tags/$kaceBranchOrTag; then
      log_error "$1 Failed to checkout $kaceBranchOrTag como rama o tag"
      exit 1
    fi
  fi

  log_info "$1 Installing packages"
  if ! npm install ; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  packageCore="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_core.git#$kaceBranchOrTag"
  log_info "$1 Installing all internal packages"
  npm install $packageCore
  if [[ $? -gt 0 ]]; then
    log_error "$1 Failed to install all packages"
    exit 1
  fi

  log_info "$1 Deploying"
  if ! npm run cdk-deploy2; then
    log_error "$1 Failed to deploy"
    exit 1
  fi
}
export -f deployFrontEnvironmentByBranch

runMigration(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Copy dotenv file"
  if ! cp ../../../.env ../../.env; then
    log_error "$1 Failed to copy dotenv file"
    exit 1
  fi

  log_info "$1 Checking out $2"
  if ! git checkout $2; then
    log_info "$1 No se encontró la rama, intentando como tag"
    if ! git checkout tags/$2; then
      log_error "$1 Failed to checkout $2 como rama o tag"
      exit 1
    fi
  fi

  log_info "$1 Installing packages"
  if ! npm install ; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 run migration"
  if ! npm run migrate:latest; then
    log_error "$1 Migration failed"
    exit 1
  fi
}
export -f runMigration


updateLocalDevelopBranch(){
  log_info "$1 updating develop branch"
  if ! cd "$destinationDirectory/$1"; then
      log_error "$1 Failed to switch to the package"
      exit 1
    fi

  log_info "$1 Switching to develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to switch to the develop branch"
    exit 1
  fi

  if ! git pull; then
    log_error "$1 Failed to pull develop branch"
    exit 1
  fi

  rm -rf node_modules
  rm -rf package-lock.json

  if ! npm install; then
    log_error "$1 Failed to install package"
    exit 1
  fi

  log_info "$1 Repository installed"
}
export -f updateLocalDevelopBranch

releaseVersion(){
  log_info "$1 releasing version"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  if ! git fetch; then
    log_error "$1 Failed to fetch latest changes"
    exit 1
  fi

  log_info "$1 Switching to develop branch"
  if ! cd "$destinationDirectory/$1" || ! git checkout develop; then
    log_error "$1 Failed to switch to the develop branch"
    exit 1
  fi

  if ! git pull; then
    log_error "$1 Failed to pull develop branch"
    exit 1
  fi

  if ! npm install; then
    log_error "$1 Failed to install package"
    exit 1
  fi

  log_info "$1 Switching to release/1.x branch"
  if ! cd "$destinationDirectory/$1" || ! git checkout release/1.x; then
    log_error "$1 Failed to switch to the release branch"
    exit 1
  fi

  if ! git pull; then
    log_error "$1 Failed to pull release branch"
    exit 1
  fi

  log_info "$1 Merging develop branch into release branch"
  if ! git merge --no-ff develop -m "Merge develop into release/1.x"; then
    log_error "$1 Failed to merge develop branch"
    exit 1
  fi

  log_info "$1 Pushing changes to release/1.x branch"
  if ! git push origin release/1.x; then
    log_error "$1 Failed to push changes"
    exit 1
  fi

  log_info "$1 Release version done!!!"
}
export -f releaseVersion

countLinesOfCode(){
  log_info "$1 Counting lines of code"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  EXTENSIONES="js"

  find "$destinationDirectory/$1" -type f -regextype posix-egrep -regex ".*\.($EXTENSIONES)$" ! -path "*/.*" | while read archivo; do
     LINEAS=$(wc -l < "$archivo")
     echo "$LINEAS líneas en $archivo"
     TOTAL=$((TOTAL + LINEAS))
  done

  echo "🔢 Total de líneas de código: $TOTAL"
}

export -f countLinesOfCode

mergeHotfix(){
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  if ! git fetch; then
    log_error "$1 Failed to fetch latest changes"
    exit 1
  fi

  log_info "$1 Switching to develop branch"
  if ! cd "$destinationDirectory/$1" || ! git checkout develop; then
    log_error "$1 Failed to switch to the develop branch"
    exit 1
  fi

  if ! git pull; then
    log_error "$1 Failed to pull develop branch"
    exit 1
  fi

  log_info "$1 Merge $2 branch into develop branch"
  if ! git merge --no-ff $2 -m "Merge $2 into develop"; then
    log_error "$1 Failed to merge hotfix branch to develop branch"
    exit 1
  fi

  log_info "$1 Pushing changes to develop branch"
  if ! git push; then
    log_error "$1 Failed to push changes"
    exit 1
  fi

  log_info "$1 switch to release branch"
  if ! git checkout release/1.x; then
    log_error "$1 Failed to switch to the release branch"
    exit 1
  fi

  if ! git pull; then
    log_error "$1 Failed to pull release branch"
    exit 1
  fi

  log_info "$1 Merge $2 branch into release branch"
  if ! git merge --no-ff $2 -m "Merge $2 into release/1.x"; then
    log_error "$1 Failed to merge hotfix branch to release branch"
    exit 1
  fi

  if ! git push; then
    log_error "$1 Failed to push changes"
    exit 1
  fi

  log_info "$1 switch to develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to switch to the develop branch"
    exit 1
  fi
}
export -f mergeHotfix

getCommitOfRelease(){
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1" > /dev/null 2>&1; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  if ! git checkout release/1.2 > /dev/null 2>&1; then
    log_error "$1 Failed to checkout release/1.2 branch"
    exit 1
  fi

  message=$(git log -1 --pretty=format:"%H")
  echo "$1 $message"
}
export -f getCommitOfRelease

switchToDevelopBranch(){
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  if ! git checkout develop; then
    log_error "$1 Failed to switch to develop branch"
    exit 1
  fi

  if ! git pull; then
    log_error "$1 Failed to pull develop branch"
    exit 1
  fi

  if ! npm install; then
    log_error "$1 Failed to install package"
    exit 1
  fi

  log_info "$1 Repository installed"
}
export -f switchToDevelopBranch

validateLibrariesVersions(){
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  if ! git checkout develop > /dev/null 2>&1; then
    log_error "$1 Failed to switch to develop branch"
    exit 1
  fi

  if ! git pull > /dev/null 2>&1; then
    log_error "$1 Failed to pull develop branch"
    exit 1
  fi

  if ! grep -q '"aws-cdk": "^2.1005.0"' package.json; then
    log_error "$1 aws-cdk@2.1005.0 no está instalado"
#    log_info "$1 Installing aws-cdk@2.1005.0"
#    if ! npm install aws-cdk@2.1005.0 --save-dev; then
#      log_error "$1 Failed to install aws-cdk package"
#      exit 1
#    fi
  fi

  if ! grep -q '"aws-cdk-lib": "^2.185.0"' package.json; then
    log_error "$1 aws-cdk-lib@2.185.0 no está instalado"
#    log_info "$1 Installing aws-cdk-lib@2.185.0"
#    if ! npm install aws-cdk-lib@2.185.0; then
#      log_error "$1 Failed to install aws-cdk-lib package"
#      exit 1
#    fi
  fi

#  if ! git add package.json; then
#    log_error "$1 Failed to add package.json"
#    exit 1
#  fi
#
#  if ! git add package-lock.json; then
#    log_error "$1 Failed to add package-lock.json"
#    exit 1
#  fi
#
#  if [ -n "$(git status --porcelain)" ]; then
#    log_info "$1 Preparing to commit"
#    message="Update npm packages"
#    if ! git commit -m "$message"; then
#      log_error "$1 Failed to commit"
#      exit 1
#    fi
#
#    log_info "$1 Pushing to develop branch"
#    if ! git push origin develop; then
#      log_error "$1 Failed to push"
#      exit 1
#    fi
#  fi

  log_info "$1 Repository checked"
}
export -f validateLibrariesVersions

createReleaseBranch(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to checkout develop branch"
    exit 1
  fi

  log_info "$1 generating release tag"
  if ! git tag -a "$versionReleaseBranch" -m "Pre-release $versionReleaseBranch"; then
    log_error "$1 Failed to create release tag"
    exit 1
  fi

  log_info "$1 generating release branch"
  if ! git checkout -b "release/$versionReleaseBranch"; then
    log_error "$1 Failed to create release branch"
    exit 1
  fi

  log_info "$1 pushing release branch"
  if ! git push origin "release/$versionReleaseBranch" --follow-tags; then
    log_error "$1 Failed to push release branch"
    exit 1
  fi

  message=$(git log -1 --pretty=format:"%H")
  echo "\"$1\";\"$message\"" >> "$workingDirectory/commits$versionReleaseBranch.csv"
  echo "| $1 | $message |" >> "$workingDirectory/commits$versionReleaseBranch.md"
}
export -f createReleaseBranch

deployApisEnvironmentByBranch(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out $kaceBranchOrTag"
  if ! git checkout $kaceBranchOrTag; then
    log_info "$1 No se encontró la rama, intentando como tag"
    if ! git checkout tags/$kaceBranchOrTag; then
      log_error "$1 Failed to checkout $kaceBranchOrTag como rama o tag"
      exit 1
    fi
  fi

  log_info "$1 Deleting package-lock.json"
  if ! rm -rf package-lock.json; then
    log_error "$1 Failed to delete package-lock.json"
    exit 1
  fi

  log_info "$1 Installing packages"
  if ! npm install ; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  packageAwsInfra="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_aws_infra.git#$kaceBranchOrTag"
  packageApiCommon="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_api_common.git#$kaceBranchOrTag"
  packageCore="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_core.git#$kaceBranchOrTag"
  packageDatabase="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_database.git#$kaceBranchOrTag"
  packagePrettier="git+ssh://git@bitbucket.org:grupokonecta/kace_cloud_prettier_config_shared.git#$kaceBranchOrTag"
  log_info "$1 Installing all internal packages"
  npm install $packageAwsInfra $packageApiCommon $packageCore $packageDatabase $packagePrettier
  if [[ $? -gt 0 ]]; then
    log_error "$1 Failed to install all packages"
    exit 1
  fi

  log_info "$1 Deploying"
  if ! npx cdk deploy --require-approval never ; then
    log_error "$1 Failed to deploy"
    exit 1
  fi
}
export -f deployApisEnvironmentByBranch

createTag(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out $currentBranch branch"
  if ! git checkout "$currentBranch"; then
    log_error "$1 Failed to checkout $currentBranch branch"
    exit 1
  fi

  log_info "$1 generating RC tag"
  if ! git tag -a "global-$tagVersion-rc"; then
    log_error "$1 Failed to create tag"
    exit 1
  fi

  log_info "$1 pushing tag"
  if ! git push origin "$tagVersion"; then
    log_error "$1 Failed to push tag"
    exit 1
  fi
}
export -f createTag

increasePatchVersion(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out develop branch"
  if ! git checkout develop; then
    log_error "$1 Failed to checkout develop branch"
    exit 1
  fi

  if ! npm install; then
    log_error "$1 Failed to install package"
    exit 1
  fi

  log_info "$1 registering version"
  if ! npm version patch -m "Upgrade to %s"; then
    log_error "$1 Failed register version"
    exit 1
  fi

  log_info "$1 pushing"
  if ! git push; then
    log_error "$1 Failed to push"
    exit 1
  fi
}
export -f increasePatchVersion

deployApisEnvironmentByBranchLocked(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Checking out $kaceBranchOrTag"
  if ! git checkout $kaceBranchOrTag; then
    log_info "$1 No se encontró la rama, intentando como tag"
    if ! git checkout tags/$kaceBranchOrTag; then
      log_error "$1 Failed to checkout $kaceBranchOrTag como rama o tag"
      exit 1
    fi
  fi

  log_info "$1 Installing packages"
  if ! npm ci ; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 Deploying"
  if ! npx cdk deploy --require-approval never ; then
    log_error "$1 Failed to deploy"
    exit 1
  fi
}
export -f deployApisEnvironmentByBranchLocked

deployFrontEnvironmentByBranchLocked(){
  log_info "$1 Cloning repository"
  if ! git clone "git@bitbucket.org:grupokonecta/$1.git" "$destinationDirectory/$1"; then
    log_error "$1 Failed to clone"
    exit 1
  fi

  log_info "$1 Switching directory"
  if ! cd "$destinationDirectory/$1"; then
    log_error "$1 Failed to switch to the package"
    exit 1
  fi

  log_info "$1 Copy dotenv file"
  if ! cp ../../../.env .env; then
    log_error "$1 Failed to copy dotenv file"
    exit 1
  fi

  log_info "$1 Checking out $kaceBranchOrTag"
  if ! git checkout $kaceBranchOrTag; then
    log_info "$1 No se encontró la rama, intentando como tag"
    if ! git checkout tags/$kaceBranchOrTag; then
      log_error "$1 Failed to checkout $kaceBranchOrTag como rama o tag"
      exit 1
    fi
  fi

  log_info "$1 Installing packages"
  if ! npm ci ; then
    log_error "$1 Failed to install packages"
    exit 1
  fi

  log_info "$1 Deploying"
  if ! npm run cdk-deploy2; then
    log_error "$1 Failed to deploy"
    exit 1
  fi
}
export -f deployFrontEnvironmentByBranchLocked
