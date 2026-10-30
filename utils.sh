#!/bin/bash

workingDirectory="$(pwd)"
export workingDirectory
source utils_base.sh
source .env

directoryPackages="$workingDirectory/packages"
directoryApis="$workingDirectory/apps/apiv1"
directoryFront="$workingDirectory/apps"
directoryDevEnvironment="$workingDirectory/deploys/dev-environment"
directoryProdEnvironment="$workingDirectory/deploys/prod-environment"
directoryStagingEnvironment="$workingDirectory/deploys/staging-environment"

release_repositories_apis_list="release_repositories_apis_list.txt"

develop_repositories_packages_list="repositories_packages_list.txt"
develop_repositories_apis_list="repositories_apis_list.txt"
develop_repositories_frontends_list="repositories_frontends_list.txt"
if [[ -n "$1" ]]; then
    apiRepository="$1"
else
    apiRepository="KO"
fi


optionInstallRepositories="Install repositories"
optionInstallPackages="Install project packages from all repositories"
optionCheckPendingChanges="Check if there are any pending changes to commit"
optionUpdateKaceInternalPackages="Update Kace internal packages"
optionResetAndCleanBranch="Reset and clean branch"
optionDeployDevEnvironment="Deploy dev environment"
optionDeployProdEnvironment="Deploy prod environment"
optionDeployEnvironmentByBranch="Deploy environment by branch"
optionListOfTags="List of tags"
optionLastCommits1="Last commits of apis repositories"
optionLastCommits2="Last commits of packages repositories"
optionDestroyDevEnvironment="Destroy dev environment"
optionDestroyProdEnvironment="Destroy Prod environment"
optionUpdateReleaseBranch="Update release branch"
optionUpdateLocalDevelopBranch="Update local develop branch"
optionMergeHotfixBranch="Merge hotfix branch"
optionGetLastCommitOfReleaseBranch="Get last commit of release branch"
optionSwitchToDevelopBranch="Switch to develop branch"
optionValidateLibrariesVersions="Validate libraries versions"
optionCreateReleaseBranch="Create release branch"
optionIncreasePatchVersion="Increase patch version"
optionCreateTag="Create tag"
optionDeployEnvironmentByBranchLocked="Deploy environment by branch LOCKED"

PS3="Select an option: "
options=(
"$optionInstallRepositories"
"$optionInstallPackages"
"$optionCheckPendingChanges"
"$optionUpdateKaceInternalPackages"
"$optionResetAndCleanBranch"
"$optionDeployDevEnvironment"
"$optionListOfTags"
"$optionLastCommits1"
"$optionLastCommits2"
"$optionDeployProdEnvironment"
"$optionDestroyDevEnvironment"
"$optionDestroyProdEnvironment"
"$optionUpdateReleaseBranch"
"$optionUpdateLocalDevelopBranch"
"$optionMergeHotfixBranch"
"$optionGetLastCommitOfReleaseBranch"
"$optionSwitchToDevelopBranch"
"$optionValidateLibrariesVersions"
"$optionCreateReleaseBranch"
"$optionDeployEnvironmentByBranch"
"$optionIncreasePatchVersion"
"$optionCreateTag"
"$optionDeployEnvironmentByBranchLocked"
"Quit")

for i in "${!options[@]}"; do
    printf "%d) %s\n" $((i+1)) "${options[$i]}"
done

read -r -p "$PS3" opt

if [[ ! "$opt" =~ ^[0-9]+$ ]] || [[ "$opt" -lt 1 ]] || [[ "$opt" -gt ${#options[@]} ]]; then
    echo "Invalid option. Please enter a number between 1 and ${#options[@]}."
    exit 1
fi

opt="${options[$((opt-1))]}"

runInstallRepositories(){
  log_info "Installing repositories"

  read -r -p "You want to install packages repositories? (y/n): " confirm
  if [[ $confirm == [yY] ]]; then
    export destinationDirectory="$directoryPackages"
    xargs -P 6 -I {} bash -c 'installRepository "$@"' _ {} < "$develop_repositories_packages_list"
  fi

  read -r -p "You want to install apis repositories? (y/n): " confirm
  if [[ $confirm == [yY] ]]; then
    export destinationDirectory="$directoryApis"
    xargs -P 6 -I {} bash -c 'installRepository "$@"' _ {} < "$develop_repositories_apis_list"
  fi

  read -r -p "You want to install frontend repositories? (y/n): " confirm
  if [[ $confirm == [yY] ]]; then
    export destinationDirectory="$directoryFront"
    xargs -P 6 -I {} bash -c 'installRepository "$@"' _ {} < "$develop_repositories_frontends_list"
  fi
}

runInstallPackages(){
  log_info "Installing packages..."
  export destinationDirectory="$directoryPackages"
  xargs -P 6 -I {} bash -c 'installPackages "$@"' _ {} < "$develop_repositories_packages_list"
  export destinationDirectory="$directoryApis"
  xargs -P 6 -I {} bash -c 'installPackages "$@"' _ {} < "$develop_repositories_apis_list"
}

runDeployDevEnvironment(){
  log_info "Deploying dev environment..."
  rm -rf "$directoryDevEnvironment"
  export destinationDirectory="$directoryDevEnvironment"

  read -r -p "Are you sure you want to run migrations? (y/n): " confirmMigrations
  read -r -p "Are you sure you want to deploy APIs? (y/n): " confirmAPIs
  read -r -p "Are you sure you want to deploy Kace-SaaS package? (y/n): " confirmPackages

  if [[ $confirmMigrations == [yY] ]]; then
    log_info "running migrations..."
    runMigration kace_cloud_database develop
  fi

  cd "$workingDirectory"
  if [[ $confirmAPIs == [yY] ]]; then
    if [[ "$apiRepository" != "KO" ]]; then
        deployApisDevEnvironment "$apiRepository"
    else
      xargs -P 10 -I {} bash -c 'deployApisDevEnvironment "$@"' _ {} < "$develop_repositories_apis_list"
    fi
  fi

  cd "$workingDirectory"
  if [[ $confirmPackages == [yY] ]]; then
    export destinationDirectory="$directoryDevEnvironment"
    deployFrontDevEnvironment kace-saas
  fi

  log_info "Cleaning dev environment..."
  rm -rf "$directoryDevEnvironment"
}

runDeployEnvironmentByBranch(){
  log_info "Deploying environment by branch..."
  rm -rf "$directoryDevEnvironment"
  export destinationDirectory="$directoryDevEnvironment"

  read -r -p "Introduce la rama o tag a desplegar: " kaceBranchOrTag
  export kaceBranchOrTag

  read -r -p "Are you sure you want to run migrations? (y/n): " confirmM
  read -r -p "Are you sure you want to deploy APIs? (y/n): " confirmA
  read -r -p "Are you sure you want to deploy Kace-SaaS package? (y/n): " confirmP

  if [[ $confirmM == [yY] ]]; then
    log_info "running migrations..."
    runMigration kace_cloud_database "$kaceBranchOrTag"
  fi

  cd "$workingDirectory"
  if [[ $confirmA == [yY] ]]; then
    if [[ "$apiRepository" != "KO" ]]; then
        deployApisEnvironmentByBranch "$apiRepository"
    else
      xargs -P 6 -I {} bash -c 'deployApisEnvironmentByBranch "$@"' _ {} < "$develop_repositories_apis_list"
    fi
  fi

  cd "$workingDirectory"
  if [[ $confirmP == [yY] ]]; then
    export destinationDirectory="$directoryDevEnvironment"
    deployFrontEnvironmentByBranch kace-saas
  fi

  log_info "Cleaning dev environment..."
  rm -rf "$directoryDevEnvironment"
}

runUpdateKaceInternalPackages(){
  message="Updating Kace internal packages to:
kace_cloud_aws_infra: $NPM_KACE_CLOUD_AWS_INFRA
kace_cloud_api_common $NPM_KACE_CLOUD_API_COMMON
kace_cloud_core $NPM_KACE_CLOUD_CORE
kace_cloud_database $NPM_KACE_CLOUD_DATABASE
kace_cloud_prettier_config_shared $NPM_KACE_CLOUD_PRETTIER_CONFIG_SHARED"

  log_info "$message"
  read -r -p "Are you sure you want to update Kace internal packages? (y/n): " confirm
  if [[ $confirm == [yY] ]]; then
    rm -rf "$directoryDevEnvironment"
    export destinationDirectory="$directoryDevEnvironment"
    xargs -P 6 -I {} bash -c 'updateKaceInternalPackages "$@"' _ {} < "$develop_repositories_apis_list"
    rm -rf "$directoryDevEnvironment"
  else
    log_info "Update Kace internal packages canceled"
  fi
}

runUpdateLocalDevelopBranch(){
  log_info "Updating local develop branch..."
  export destinationDirectory="$directoryApis"
  xargs -P 6 -I {} bash -c 'updateLocalDevelopBranch "$@"' _ {} < "$develop_repositories_apis_list"
  export destinationDirectory="$directoryPackages"
  xargs -P 6 -I {} bash -c 'updateLocalDevelopBranch "$@"' _ {} < "$develop_repositories_packages_list"
}

runDeployProdEnvironment(){
  log_info "Deploying PROD environment..."
  log_info "Preparing work directory for PROD environment..."
  rm -rf "$directoryProdEnvironment"

  read -r -p "You want to deploy microservice repositories? (y/n): " confirm
  if [[ $confirm == [yY] ]]; then
    export destinationDirectory="$directoryProdEnvironment"
    parallel -j "$BASH_PARALLEL_PROCESS" --colsep ' ' "deployProdEnvironment {1} {2}" < version_"$develop_repositories_apis_list"
  fi

  read -r -p "You want to deploy frontend repositories? (y/n): " confirm
  if [[ $confirm == [yY] ]]; then
    export destinationDirectory="$directoryProdEnvironment"
    parallel -j "$BASH_PARALLEL_PROCESS" --colsep ' ' "deployFrontendProdEnvironment {1} {2}" < version_"$develop_repositories_frontends_list"
  fi

  log_info "Cleaning PROD environment..."
  rm -rf "$directoryProdEnvironment"
}

runMergeHotfixBranch(){
  read -r -p "You want to merge hotfix branch? (y/n): " confirm

  if [[ $confirm == [yY] ]]; then
    log_info "Merging hotfix branch..."
    export destinationDirectory="$workingDirectory"
    parallel -j "$BASH_PARALLEL_PROCESS" --colsep ' ' "mergeHotfix {1} {2}" < hotfix_list.txt
  fi
}

runSwitchToDevelopBranch(){
  log_info "Switching to develop branch..."
  export destinationDirectory="$directoryApis"
  xargs -P 6 -I {} bash -c 'switchToDevelopBranch "$@"' _ {} < "$develop_repositories_apis_list"
  export destinationDirectory="$directoryPackages"
  xargs -P 6 -I {} bash -c 'switchToDevelopBranch "$@"' _ {} < "$develop_repositories_packages_list"
  export destinationDirectory="$directoryFront"
  xargs -P 6 -I {} bash -c 'switchToDevelopBranch "$@"' _ {} < "$develop_repositories_frontends_list"
}

runValidateLibrariesVersions(){
  log_info "Validating libraries versions..."
  export destinationDirectory="$directoryPackages"
  xargs -P 6 -I {} bash -c 'validateLibrariesVersions "$@"' _ {} < "$develop_repositories_packages_list"
  export destinationDirectory="$directoryApis"
  xargs -P 6 -I {} bash -c 'validateLibrariesVersions "$@"' _ {} < "$develop_repositories_apis_list"
}

runCreateReleaseBranch(){
  log_info "Creating release branch..."
  rm -rf "$directoryDevEnvironment"
  read -r -p "Indicates the version to be assigned for the release branch: " version
  export versionReleaseBranch="$version"

  rm "$workingDirectory/commits$version.csv" "$workingDirectory/commits$version.md" utils.log
  echo "\"Repositorio\";\"Commit\"" >> "$workingDirectory/commits$versionReleaseBranch.csv"
  echo "| Repositorio | Commit |" >> "$workingDirectory/commits$versionReleaseBranch.md"
  echo "|-|-|" >> "$workingDirectory/commits$versionReleaseBranch.md"

  read -r -p "You want to proceed with the Apis repositories? (y/n): " confirmApis
  read -r -p "You want to proceed with the Packages repositories? (y/n): " confirmPackages
  read -r -p "You want to proceed with the Frontend repositories? (y/n): " confirmFrontend
  if [[ $confirmApis == [yY] ]]; then
    export destinationDirectory="$directoryDevEnvironment"
    if [[ "$apiRepository" != "KO" ]]; then
      createReleaseBranch "$apiRepository"
    else
      xargs -P 6 -I {} bash -c 'createReleaseBranch "$@"' _ {} < "$develop_repositories_apis_list"
    fi
  fi

  if [[ $confirmPackages == [yY] ]]; then
    export destinationDirectory="$directoryDevEnvironment"
    xargs -P 6 -I {} bash -c 'createReleaseBranch "$@"' _ {} < "$develop_repositories_packages_list"
  fi

  if [[ $confirmPackages == [yY] ]]; then
      export destinationDirectory="$directoryDevEnvironment"
      xargs -P 6 -I {} bash -c 'createReleaseBranch "$@"' _ {} < "$develop_repositories_frontends_list"
    fi

  log_info "Cleaning dev environment..."
  rm -rf "$directoryDevEnvironment"

#  TODO: Add frontend repositories
}

runCreateTag(){
  log_info "Creating tag..."
  rm -rf "$directoryDevEnvironment"
  read -r -p "Indicates the branch: " currentBranch
  export currentBranch="$currentBranch"
  read -r -p "Indicates the tag to be assigned (X.X.X): " version
  export tagVersion="$version"

  export destinationDirectory="$directoryDevEnvironment"
  xargs -P 6 -I {} bash -c 'createTag "$@"' _ {} < "$develop_repositories_apis_list"

  export destinationDirectory="$directoryDevEnvironment"
  xargs -P 6 -I {} bash -c 'createTag "$@"' _ {} < "$develop_repositories_packages_list"

  export destinationDirectory="$directoryDevEnvironment"
  xargs -P 6 -I {} bash -c 'createTag "$@"' _ {} < "$develop_repositories_frontends_list"

  log_info "Cleaning dev environment..."
  rm -rf "$directoryDevEnvironment"
}

runIncreasePatchVersion(){
  log_info "Creating patch version..."
  rm -rf "$directoryDevEnvironment"

  export destinationDirectory="$directoryDevEnvironment"
  xargs -P 6 -I {} bash -c 'increasePatchVersion "$@"' _ {} < "$develop_repositories_apis_list"

  export destinationDirectory="$directoryDevEnvironment"
  xargs -P 6 -I {} bash -c 'increasePatchVersion "$@"' _ {} < "$develop_repositories_packages_list"

  export destinationDirectory="$directoryDevEnvironment"
  xargs -P 6 -I {} bash -c 'increasePatchVersion "$@"' _ {} < "$develop_repositories_frontends_list"

  log_info "Cleaning dev environment..."
  rm -rf "$directoryDevEnvironment"
}

runDeployEnvironmentByBranchLocked(){
  log_info "Deploying environment by branch LOCKED..."
  rm -rf "$directoryDevEnvironment"
  export destinationDirectory="$directoryDevEnvironment"

  read -r -p "Introduce la rama o tag a desplegar: " kaceBranchOrTag
  export kaceBranchOrTag

  read -r -p "Are you sure you want to run migrations? (y/n): " confirmM
  read -r -p "Are you sure you want to deploy APIs? (y/n): " confirmA
  read -r -p "Are you sure you want to deploy Kace-SaaS package? (y/n): " confirmP

  if [[ $confirmM == [yY] ]]; then
    log_info "running migrations..."
    runMigration kace_cloud_database "$kaceBranchOrTag"
  fi

  cd "$workingDirectory"
  if [[ $confirmA == [yY] ]]; then
    if [[ "$apiRepository" != "KO" ]]; then
        deployApisEnvironmentByBranchLocked "$apiRepository"
    else
      xargs -P 6 -I {} bash -c 'deployApisEnvironmentByBranchLocked "$@"' _ {} < "$develop_repositories_apis_list"
    fi
  fi

  cd "$workingDirectory"
  if [[ $confirmP == [yY] ]]; then
    export destinationDirectory="$directoryDevEnvironment"
    deployFrontEnvironmentByBranchLocked kace-saas
  fi

  log_info "Cleaning dev environment..."
  rm -rf "$directoryDevEnvironment"
}

case $opt in
    "$optionInstallRepositories")
        runInstallRepositories
        ;;
    "$optionInstallPackages")
        runInstallPackages
        ;;
    "$optionCheckPendingChanges")
        log_info "Checking pending changes..."
        export destinationDirectory="$directoryPackages"
        parallel -j "$BASH_PARALLEL_PROCESS" checkPendingChanges < "$develop_repositories_packages_list"
        export destinationDirectory="$directoryApis"
        parallel -j "$BASH_PARALLEL_PROCESS" checkPendingChanges < "$develop_repositories_apis_list"
        export destinationDirectory="$directoryFront"
        parallel -j "$BASH_PARALLEL_PROCESS" checkPendingChanges < "$develop_repositories_frontends_list"
        ;;
    "$optionUpdateKaceInternalPackages")
        runUpdateKaceInternalPackages
        ;;
    "$optionResetAndCleanBranch")
        log_info "Resetting and cleaning branch..."
        read -r -p "Are you sure you want to reset and clean the branch? (y/n): " confirm
        if [[ $confirm == [yY] ]]; then
            export destinationDirectory="$directoryApis"
            parallel -j "$BASH_PARALLEL_PROCESS" resetAndCleanBranch < "$develop_repositories_apis_list"
        else
            log_info "Reset and clean branch canceled"
        fi
        ;;
    "$optionDeployDevEnvironment")
        runDeployDevEnvironment
        ;;
    "$optionListOfTags")
        log_info "List of tags..."
        export destinationDirectory="$directoryPackages"
        xargs -I {} bash -c 'getGitTags "$@"' _ {} < "$develop_repositories_packages_list"
        export destinationDirectory="$directoryApis"
        xargs -I {} bash -c 'getGitTags "$@"' _ {} < "$develop_repositories_apis_list"
        ;;
    "$optionLastCommits1")
        log_info "Last commits..."
        export destinationDirectory="$directoryApis"
        parallel -j "$BASH_PARALLEL_PROCESS" getLastCommitHash < "$develop_repositories_apis_list"
        ;;
    "$optionLastCommits2")
        log_info "Last commits..."
        export destinationDirectory="$directoryPackages"
        parallel -j "$BASH_PARALLEL_PROCESS" getLastCommitHash < "$develop_repositories_packages_list"
         ;;
    "$optionGetLastCommitOfReleaseBranch")
        log_info "Preparing work directory for PROD environment..."
        rm -rf "$directoryProdEnvironment"
        log_info "Last Apis commits..."
        export destinationDirectory="$directoryProdEnvironment"
        parallel -j "$BASH_PARALLEL_PROCESS" getCommitOfRelease < "$develop_repositories_apis_list"
        log_info "Last packages commits..."
        parallel -j "$BASH_PARALLEL_PROCESS" getCommitOfRelease < "$develop_repositories_packages_list"
        log_info "Cleaning PROD environment..."
        rm -rf "$directoryProdEnvironment"
        ;;
    "$optionDeployProdEnvironment")
        runDeployProdEnvironment
        ;;
    "$optionDestroyDevEnvironment")
        log_info "Destroying dev environment..."
        export destinationDirectory="$directoryDevEnvironment"
        parallel -j "$BASH_PARALLEL_PROCESS" destroyDevEnvironment < "$develop_repositories_apis_list"
        log_info "Cleaning dev environment..."
        rm -rf "$directoryDevEnvironment"
        ;;
    "$optionDestroyProdEnvironment")
        log_info "Destroying PROD environment..."
        rm -rf "$directoryProdEnvironment"
        export destinationDirectory="$directoryProdEnvironment"
        parallel -j "$BASH_PARALLEL_PROCESS" --colsep ' ' "destroyProdEnvironment {1} {2}" < version_"$develop_repositories_apis_list"
        log_info "Cleaning PROD environment..."
        rm -rf "$directoryProdEnvironment"
        ;;
    "$optionUpdateReleaseBranch")
        log_info "Updating release branch..."

        rm -rf "$directoryStagingEnvironment"

        export destinationDirectory="$directoryStagingEnvironment"

        read -r -p "¿You want to process apis repositories? (y/n): " confirm
        if [[ $confirm == [yY] ]]; then
          xargs -P 6 -I {} bash -c 'updateReleaseBranch "$@"' _ {} 1.2 < "$release_repositories_apis_list"
        fi

        log_info "Cleaning staging environment..."
        rm -rf "$directoryStagingEnvironment"
        ;;
    "$optionUpdateLocalDevelopBranch")
        runUpdateLocalDevelopBranch
        ;;
    "$optionMergeHotfixBranch")
        runMergeHotfixBranch
        ;;
    "$optionSwitchToDevelopBranch")
        runSwitchToDevelopBranch
        ;;
    "$optionValidateLibrariesVersions")
        runValidateLibrariesVersions
        ;;
    "$optionCreateReleaseBranch")
        runCreateReleaseBranch
        ;;
    "$optionDeployEnvironmentByBranch")
        runDeployEnvironmentByBranch
        ;;
    "$optionIncreasePatchVersion")
        runIncreasePatchVersion
        ;;
    "$optionCreateTag")
        runCreateTag
        ;;
    "$optionDeployEnvironmentByBranchLocked")
        runDeployEnvironmentByBranchLocked
        ;;
    "Quit")
        ;;
    *) echo "invalid option $REPLY";;
esac

log_info "$opt DONE!!!"
