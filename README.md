# Exptool 📲

* Exptool was created to help automate [expo standalone](https://docs.expo.io/versions/latest/guides/building-standalone-apps.html) iOS and Android builds and deployments.
* Exptool + [exp](https://docs.expo.io/versions/latest/guides/exp-cli.html) + [fastlane](https://fastlane.tools) = 🏆🥇.
  * See [example](#examples) below for more details on how to combine these 💯 tools.

## Getting Started

Install via npm (or yarn):

```bash
$ npm install -g exptool
```

## Usage

```bash
$ exptool --help
```

```
  Usage: exptool [options] [command]

  Expo toolset to help with automation

  Options:

    -V, --version  output the version number
    -h, --help     output usage information

  Commands:

    check:status [project-dir]                 Checks the build status for a given project. Will exit with non-zero status code if the project is already building
    wait:build [options] [project-dir]         Wait for active build to complete
    download:artifact [options] [project-dir]  Downloads the most recent artifact for a given project
    url:artifact [project-dir]                 Prints the latest url artifact for a given project
    url:expo [options] [project-dir]           Prints the expo url for a given project and [optional] release channel
    android:package [project-dir]              Prints the android package name for a given project (reads from app.json)
```

## Examples

* [Bash Script](#bash-script-example)
* [GitLab CI/CD YAML](#gitlab-cicd-yaml-example)

## Bash Script Example

The following is a bash script to build iOS & Android production standalone apps.

You can run this script on your local machine, or ideally, translate these commands to your continuous-integration/continuous-deployment service.

**Note** the script uses some env variables (`EXPO_USERNAME` & `EXPO_PASSWORD`) which you can either replace with raw values within the script or set the values within your environment (recommended).

```bash
# Exptool will exit with non-zero statuses when a certain command fails.
# It's useful to exit the bash script when a command exits with a non-zero status
# as the following commands must be run successfully in sequence for expected results.
set -e # exit entire script when command exits with non-zero status

# Install dependencies
npm install

# Login to expo using username & password
# (you may already be logged in depending on your setup)
exp login -u $EXPO_USERNAME -p $EXPO_PASSWORD --non-interactive

# Publish `production` release 
exp publish --release-channel production --non-interactive

#### =============== ####
#### === Android === ####
#### =============== ####
# Makes sure that there are no active standalone apps being built at this time
exptool check:status 

# Start building standalone android build using `production` release channel
exp build:android --release-channel production --non-interactive

# Wait for the build to finish, checking its status every 2 mins (timeout is 20 mins)
# Will exit 0 (success) once the build has successfully been built
exptool wait:build --interval 120 --timeout 1200

# Download the artifact to current directory as `app.apk`
exptool download:artifact

# [Optional/Advanced] Use fastlane to upload your current standalone android build
# Uncomment below if you know how to use fastlane
# fastlane supply --package_name "$(exptool android:package)" --apk "app.apk" --json_key_data "$JSON_KEY_DATA" --skip_upload_metadata --skip_upload_images --skip_upload_screenshots

#### =========== ####
#### === iOS === ####
#### =========== ####
# This section is extremely similar to android steps above, take 
# a look there if you have any questions.
exptool check:status
exp build:ios --release-channel production --non-interactive
exptool wait:build # using default interval & timeout
exptool download:artifact

# [Optional/Advanced] Use fastlane to upload your current standalone iOS build to itc
# set $FASTLANE_PASSWORD=[your-password] if you want to skip password prompt
# Uncomment below if you know how to use fastlane
# fastlane deliver --verbose --ipa "app.ipa" --username "$ITC_EMAIL" --skip_screenshots --skip_metadata

```

## GitLab CI/CD YAML Example

The following yaml uses [exp](https://docs.expo.io/versions/latest/guides/exp-cli.html) and [fastlane](https://fastlane.tools). The script is setup so:

* Every push to master builds dependencies.
* Every new git tag builds and publishes standalone apps to google play or itunes connect.

You'll also need to set the appropriate [env variables on GitLab for your project](https://docs.gitlab.com/ce/ci/variables/README.html#secret-variables). Environment variables used are:

* `EXPO_USERNAME`
  * Your project's associated expo username.
* `EXPO_PASSWORD`
  * Your project's associated expo password.
* `JSON_KEY_DATA`
  * Data referring to your Google Developers Service Account (required for `fastlane supply`).
  * [Setup tutorial](https://docs.fastlane.tools/actions/supply/#setup).
* `ITC_EMAIL`
  * Your email associated with your [iTunes Connect](https://itunesconnect.apple.com/) account.
* `FASTLANE_PASSWORD`
  * Your password associated with your [iTunes Connect](https://itunesconnect.apple.com/) account.
  * Not accessed directly in the follow yaml, but is required for `fastlane deliver` if you want to skip the password prompt which is necessary for CI/CD.

**Note:** `fastlane deliver` command will only work on macOS.

```yaml
after_script:
  - exp logout

cache:
  untracked: true
  key: "$CI_COMMIT_SHA"
  paths:
    - node_modules/

stages:
  - setup
  - publish_production
  - deploy_android_google_play
  - deploy_ios_test_flight

setup:
  stage: setup
  script:
    - npm install
  only:
    - master
  tags:
    - mac # tag associated with mac gitlab-runner

publish_production:
  stage: publish_production
  script:
    - exp login -u $EXPO_USERNAME -p $EXPO_PASSWORD --non-interactive
    - exp publish --release-channel production --non-interactive
  only:
    - tags
  tags:
    - mac # tag associated with mac gitlab-runner

deploy_android_google_play:
  stage: deploy_android_google_play
  script:
    - exp login -u $EXPO_USERNAME -p $EXPO_PASSWORD --non-interactive
    - exptool check:status
    - exp build:android --release-channel production --non-interactive
    - exptool wait:build --interval 120 --timeout 1200
    - exptool download:artifact
    - fastlane supply --package_name "$(exptool android:package)" --apk "app.apk" --json_key_data "$JSON_KEY_DATA" --skip_upload_metadata --skip_upload_images --skip_upload_screenshots
  only:
    - tags
  tags:
    - mac # tag associated with mac gitlab-runner

deploy_ios_test_flight:
  stage: deploy_ios_test_flight
  script:
    - exp login -u $EXPO_USERNAME -p $EXPO_PASSWORD --non-interactive
    - exptool check:status
    - exp build:ios --release-channel production --non-interactive
    - exptool wait:build
    - exptool download:artifact
    - fastlane deliver --verbose --ipa "app.ipa" --username "$ITC_EMAIL" --skip_screenshots --skip_metadata
  only:
    - tags
  tags:
    - mac # tag associated with mac gitlab-runner
```

