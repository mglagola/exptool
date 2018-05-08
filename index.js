#! /usr/bin/env node

const Promise = require('bluebird');
global.Promise = Promise;

const pkg = require('./package.json');
const program = require('commander');
const fs = require('fs');
const chalk = require('chalk');
const F = require('lodash/fp');
const isEmpty = require('lodash/isEmpty');
const {
    resolveHome,
    readJSONfile,
    parseInteger,
    set,
} = require('./lib/utils');
const {
    readBuildManifest,
    ensureNotRunning,
    checkIfBuilt,
    fetchArtifactJobs,
    downloadArtifact,
    buildManifestFilePathFromDir,
} = require('./lib/expo');
const { logVersionCheck } = require('validate-package-version');

const tryCatchCmd = (func) => async (...args) => {
    try {
        const success = await func(...args);
        return process.exit(success ? 0 : 1);
    } catch (error) {
        console.log(chalk.red(error.message));
        console.error(error.stack);
        return process.exit(1);
    }
};

const act = (func, ignoreVersionCheck = false) => async (...args) => {
    if (!ignoreVersionCheck) {
        await logVersionCheck(pkg);
    }
    return tryCatchCmd(func)(...args);
};

const mapProjectDirToExpoInfo = async (dir) => {
    const expoState = await readJSONfile(resolveHome('~/.expo/state.json'));
    const projectManifest = await readBuildManifest(dir);
    return { expoState, projectManifest };
};

const logDeprecatedCommand = (cmd, replacementCmd) => {
    // console.log('');
    // console.log(chalk.red(`"${chalk.bold(`exptool ${cmd}`)}" is deprecated.`));
    // if (replacementCmd) {
    //     console.log(chalk.red(`Try using ${chalk.bold(replacementCmd)} instead.`));
    // }
    // console.log(`See ${chalk.underline('https://github.com/mglagola/exptool/wiki/Deprecations')} for more info on deprecations.`);
    // console.log('');
};

program
    .command('url:expo [project-dir]')
    .description('Prints the expo url for a given project and [optional] release channel')
    .option('-r, --release-channel [channel]', 'Specify release channel (staging, production, etc)')
    .action(act(async (dir, { releaseChannel }) => {
        const { expoState, projectManifest } = await mapProjectDirToExpoInfo(dir);
        const job = F.head(await fetchArtifactJobs(projectManifest, expoState));
        const url = `https://expo.io/${job.fullExperienceName}${F.isNil(releaseChannel) ? '' : `?release-channel=${releaseChannel}`}`;
        console.log(url);
        return true;
    }, true));

program
    .command('android:package [project-dir]')
    .description('Prints the android package name for a given project (reads from app.json)')
    .action(act(async (dir) => {
        const projectManifest = await readBuildManifest(dir);
        const path = ['android', 'package'];
        const packageName = F.get(path, projectManifest);
        if (isEmpty(packageName)) {
            const message = `Couldn't find a value associated with "${path.join('.')}" in your project's app.json`;
            console.log(chalk.red(message));
            return false;
        }
        console.log(packageName);
        return true;
    }, true));

program
    .command('inc:build [project-dir]')
    .description('Increments the ios.buildNumber and android.versionCode in app.json')
    .action(act(async (dir) => {
        const projectManifest = await readBuildManifest(dir, null);

        const iosBuildNum = parseInteger(0, F.getOr(0, ['expo', 'ios', 'buildNumber'], projectManifest));
        const androidVersionCode = F.getOr(0, ['expo', 'android', 'versionCode'], projectManifest);
        const newBuildNum = Math.max(iosBuildNum, androidVersionCode) + 1;

        const setObj = F.curry(set);
        const newManifest = F.compose(
            setObj(['expo', 'ios', 'buildNumber'], `${newBuildNum}`),
            setObj(['expo', 'android', 'versionCode'], newBuildNum)
        )(projectManifest);

        const manifestPath = buildManifestFilePathFromDir(dir);
        fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2));
        return true;
    }));

program
    .command('check:status [project-dir]')
    .description('[Deprecated] Checks the build status for a given project. Will exit with non-zero status code if the project is already building')
    .action(act(async (dir, options) => {
        logDeprecatedCommand('check:status');
        const { expoState, projectManifest } = await mapProjectDirToExpoInfo(dir);
        const res = await ensureNotRunning(projectManifest, expoState);
        console.log(res
            ? chalk.green('No active builds for this project, good to go!')
            : chalk.red('This project is already building, aborting...')
        );
        return res;
    }));

program
    .command('wait:build [project-dir]')
    .description('[Deprecated] Wait for active build to complete')
    .option('-i, --interval [sleep-interval-seconds]', 'Sleep interval between checks')
    .option('-t, --timeout [timeout-seconds]', 'Max amount of seconds to wait before timing out')
    .action(act(async (dir, options) => {
        logDeprecatedCommand('wait:build', 'exp build:{ios|android}');
        const { expoState, projectManifest } = await mapProjectDirToExpoInfo(dir);
        return await checkIfBuilt(projectManifest, expoState, options);
    }));

program
    .command('download:artifact [project-dir]')
    .description('[Deprecated] Downloads the most recent artifact for a given project')
    .option('-t, --to-dir [dir]', 'Specify dir to download artifact to. Default is current directory')
    .action(act(async (dir, { toDir }) => {
        const { expoState, projectManifest } = await mapProjectDirToExpoInfo(dir);
        const artifacts = await fetchArtifactJobs(projectManifest, expoState);
        const downloadToDir = toDir || process.cwd();
        await Promise.all(artifacts.map(job => downloadArtifact(resolveHome(downloadToDir), job)));
        return true;
    }));

program
    .command('url:artifact [project-dir]')
    .description('[Deprecated] Prints the latest url artifact for a given project')
    .action(act(async (dir, options) => {
        const { expoState, projectManifest } = await mapProjectDirToExpoInfo(dir);
        const job = F.head(await fetchArtifactJobs(projectManifest, expoState));
        console.log(job.artifacts.url);
        return true;
    }, true));

program
    .version(pkg.version)
    .description(pkg.description)
    .parse(process.argv);

if (isEmpty(program.args)) {
    console.log(chalk.red('Please specify a command. Use --help to learn more.'));
    process.exit(1);
}
