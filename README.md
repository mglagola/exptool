Exptool was originally created to help automate standalone expo app builds, but [exp](https://docs.expo.io/versions/latest/guides/exp-cli.html) recently implemented the [necessary](https://github.com/expo/exp/pull/102) [features](https://github.com/expo/exp/pull/103) required to fulfill this goal.

**Exptool is no longer needed to automate expo standalone builds**. Take a look at this [blog post](https://blog.expo.io/automating-standalone-expo-app-builds-and-deployments-with-fastlane-exp-and-exptool-9b2f5ad0a2cd) if you're looking to automate your standalone builds without exptool.

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
    inc:build [project-dir]                    Increments the ios.buildNumber and android.versionCode in app.json
```

## Examples

#### Blog Posts

* [Automating Standalone Expo App Builds and Deployments with Fastlane, Exp, and Exptool](https://blog.expo.io/automating-standalone-expo-app-builds-and-deployments-with-fastlane-exp-and-exptool-9b2f5ad0a2cd)

#### Wiki

* [Step By Step Example Usage](#step-by-step-example-usage)
* [Bash Script Example](https://github.com/mglagola/exptool/wiki/Bash-Script-Example)
* [GitLab CI CD YAML Example](https://github.com/mglagola/exptool/wiki/GitLab-CI-CD-YAML-Example)

## Step By Step Example Usage

_**Note**: The following example is a shortened version of [a longer blog post walkthrough](https://blog.expo.io/automating-standalone-expo-app-builds-and-deployments-with-fastlane-exp-and-exptool-9b2f5ad0a2cd)._

The following is a sequence of bash commands that, when executed in sequence, will automate your expo iOS and Android standalone app builds and deployments.

You can run these commands on your local machine, or ideally, **translate these commands to your continuous-integration/continuous-deployment service**. These commands are written to be ran in the same directory as your expo project.

This is meant to be a guide, so customize it to fit your automation needs!

#### Prerequisites / Notes

* This guide assumes you have [exp](https://docs.expo.io/versions/latest/guides/exp-cli.html) and [fastlane](https://fastlane.tools) installed and understand how to use them!
* Be conscious of env variables along the way.
* If you decide to use [fastlane](https://fastlane.tools), the `fastlane deliver` command will only work on macOS.

#### Setup

```bash
# Install dependencies.
npm install

# [Optional] Login to expo using username & password.
# You may or may not need to do this depending on your setup.
# Note the $EXPO_USERNAME and $EXPO_PASSWORD env variables.
exp login -u $EXPO_USERNAME -p $EXPO_PASSWORD --non-interactive
```

#### Publish To Expo

```bash
# Publish `production` release
exp publish --release-channel production --non-interactive
```

#### Build Standalone Android APK

```bash
# Makes sure that there are no active standalone apps being built at this time.
# Will exit with a non-zero status code if there is an active standalone app already being built.
exptool check:status 

# Start building standalone android build using `production` release channel.
exp build:android --release-channel production --non-interactive

# Wait for the build to finish, checking its status every 2 mins (timeout is 20 mins).
# Will exit 0 (success) once the build has successfully been built.
# Android builds take a little longer in my experience, hence the longer interval and timeout.
exptool wait:build --interval 120 --timeout 1200

# Download the artifact to current directory as `app.apk`
exptool download:artifact

# [Optional/Advanced] Use fastlane to upload your current standalone android build.
# Customize this to fit your needs. Take note of env variables. 
# Check out https://docs.fastlane.tools for more info.
fastlane supply --package_name "$(exptool android:package)" --apk "app.apk" --json_key_data "$JSON_KEY_DATA" --skip_upload_metadata --skip_upload_images --skip_upload_screenshots
```

#### Build Standalone iOS IPA
```bash
# This section is extremely similar to android steps above,
# take a look there if you have any questions.
exptool check:status
exp build:ios --release-channel production --non-interactive
exptool wait:build # using default interval & timeout
exptool download:artifact

# [Optional/Advanced] Use fastlane to upload your current standalone iOS build to iTunes Connect.
# set $FASTLANE_PASSWORD=<your-itunes-connect-password> if you want to skip password prompt.
# Take note of env variables.
# Check out https://docs.fastlane.tools for more info.
fastlane deliver --verbose --ipa "app.ipa" --username "$ITC_EMAIL" --skip_screenshots --skip_metadata
```

#### Tear Down
```bash
# [Optional] You may or may not need to do this depending on your setup.
exp logout
```

## Questions, Issues, Feature Requests

Something missing? Have a question? Create a pull request or open an issue.
