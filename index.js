#! /usr/bin/env node

const Promise = require('bluebird');
global.Promise = Promise;

const pkg = require('./package.json');
const program = require('commander');
const chalk = require('chalk');
const F = require('lodash/fp');
const isEmpty = require('lodash/isEmpty');
const {
    resolveHome,
    readJSONfile,
} = require('./lib/utils');
const {
    readBuildManifest,
    ensureNotRunning,
    checkIfBuilt,
    fetchArtifactJobs,
    downloadArtifact,
} = require('./lib/expo');
const validatePackageVersion = require('./lib/validate-package-version');

const resolveManifestDir = (dir) => dir ? resolveHome(dir) : process.cwd();

async function logVersionCheck () {
    try {
        const { name, version } = pkg;
        const {
            isOutdated,
            npmVersion,
        } = await validatePackageVersion({ name, currentVersion: version });
        if (isOutdated) {
            console.log(`${chalk.cyan.bold(name)} is outdated (current: ${chalk.cyan.bold(version)}, latest: ${chalk.cyan.bold(npmVersion)})`);
            console.log(`You can update by running: ${chalk.cyan.bold(`npm install -g ${name}`)}`);
            console.log('');
        }
    } catch (error) {} // fail silently
}

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

const act = (func) => async (...args) => {
    await logVersionCheck();
    return tryCatchCmd(func)(...args);
};

const mapProjectDirToExpoInfo = async (dir) => {
    const expoState = await readJSONfile(resolveHome('~/.expo/state.json'));
    const projectManifest = await readBuildManifest(resolveManifestDir(dir));
    return { expoState, projectManifest };
};

program
    .command('check:status [project-dir]')
    .description('Checks the build status for a given project. Will exit with non-zero status code if the project is already building')
    .action(act(async (dir, options) => {
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
    .description('Wait for active build to complete')
    .option('-i, --interval [sleep-interval-seconds]', 'Sleep interval between checks')    
    .option('-t, --timeout [timeout-seconds]', 'Max amount of seconds to wait before timing out')
    .action(act(async (dir, options) => {
        const { expoState, projectManifest } = await mapProjectDirToExpoInfo(dir);        
        return await checkIfBuilt(projectManifest, expoState, options);
    }));

program
    .command('download:artifact [project-dir]')
    .description('Downloads the most recent artifact for a given project')        
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
    .description('Prints the latest url artifact for a given project')    
    .action(act(async (dir, options) => {
        const { expoState, projectManifest } = await mapProjectDirToExpoInfo(dir);        
        const job = F.head(await fetchArtifactJobs(projectManifest, expoState));
        console.log(job.artifacts.url);
        return true;
    }));

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
    }));

program
    .command('android:package [project-dir]')
    .description('Prints the android package name for a given project (reads from app.json)')
    .action(act(async (dir) => {
        const projectManifest = await readBuildManifest(resolveManifestDir(dir));
        const path = ['android', 'package'];
        const packageName = F.get(path, projectManifest);
        if (isEmpty(packageName)) {
            const message = `Couldn't find a value associated with "${path.join('.')}" in your project's app.json`;
            console.log(chalk.red(message));
            return false;
        }
        console.log(packageName);        
        return true;
    }));

program
    .version(pkg.version)
    .description(pkg.description)
    .parse(process.argv);

if (isEmpty(program.args)) {
    console.log(chalk.red('Please specify a command. Use --help to learn more.'));
    process.exit(1);
}
