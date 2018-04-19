const chalk = require('chalk');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const rp = require('request-promise');
const F = require('lodash/fp');
const isEmpty = require('lodash/isEmpty');
const {
    sleep,
    downloadFile,
    resolveHome,
} = require('./utils');

const ARTIFACT_PLATFORM_EXTENSIONS = {
    ios: 'ipa',
    android: 'apk',
};

const ARTIFACT_BUILT_TIMEOUT = 60 * 15; // default timeout is 15 mins
const ARTIFACT_SLEEP_TIMEOUT = 60;      // default sleep for 60 seconds

const secondsToMilliseconds = (seconds) => seconds * 1000;

const resolveManifestDir = (dir) => dir ? resolveHome(dir) : process.cwd();
const buildManifestFilePathFromDir = (dir) => path.join(resolveManifestDir(dir), 'app.json');

async function readBuildManifest (dir, path = ['expo']) {
    const filename = buildManifestFilePathFromDir(dir);
    const contents = await fs.readFileAsync(filename);
    const json = JSON.parse(contents);
    return isEmpty(path)
        ? json
        : F.get(path, json);
}

async function buildStatus (projectManifest, expState = {}) {
    const { accessToken, auth = {} } = expState;
    const res = await rp({
        url: 'https://exp.host/--/api/build/[]',
        headers: {
            'Expo-Session': auth.sessionSecret,
            'Exp-Access-Token': accessToken,
            'Content-Type': 'application/json',
        },
        method: 'put',
        body: {
            manifest: projectManifest,
            options: {
                current: false,
                mode: 'status',
            },
        },
        json: true,
    });
    return res;
}

const isStatusInProgress = F.compose(
    x => x.length > 0,
    F.filter(x => x.status === 'in-progress'),
    F.propOr([], 'jobs')
);

async function ensureNoInProgressBuilds (projectManifest, expState) {
    try {
        if (isStatusInProgress(await buildStatus(projectManifest, expState))) {
            return false;
        }
        return true;
    } catch (error) {
        const message = F.get(['response', 'body', 'err'], error);
        if (message === 'This experience is missing a name and cannot be published.') {
            // user never published this app before, aka no build in process
            // not ideal check as message can change, but will work for now until check:status is deprecated
            return true;
        }
        throw error;
    }
}

async function fetchArtifactJobs (projectManifest, expState) {
    const status = await buildStatus(projectManifest, expState);
    const jobs = F.propOr([], 'jobs', status);
    return jobs;
}

async function ensureNotRunning (projectManifest, expState) {
    return await ensureNoInProgressBuilds(projectManifest, expState);
}

async function checkIfBuilt (projectManifest, expState, { timeout = ARTIFACT_BUILT_TIMEOUT, interval = ARTIFACT_SLEEP_TIMEOUT } = {}) {
    let startTime = new Date().getTime();
    const endTime = startTime + secondsToMilliseconds(timeout); // 15 mins
    while (startTime <= endTime) {
        const job = F.head(await fetchArtifactJobs(projectManifest, expState));
        const jobStatus = job.status;
        switch (jobStatus) {
        case 'finished':
            console.log(chalk.green('Artifact built:'), chalk.underline(job.artifacts.url));
            return true;
        case 'in-progress':
            console.log(`Artifact still building, checking again in ${interval}s ...`);
            break;
        default:
            console.log(chalk.red(`Unknown status: ${jobStatus} - aborting!`));
            return false;
        }
        startTime = new Date().getTime();
        await sleep(secondsToMilliseconds(interval));
    }
    console.log(chalk.red(`Timeout reached! Project is taking longer than expected to finish building, aborting...`));
    return false;
}

async function downloadArtifact (toDir, job = {}) {
    if (F.isNil(job.artifacts) || F.isNil(job.artifacts.url)) {
        throw new Error(`No artifact found for job - ${job.id}`);
    }
    const artifactExt = ARTIFACT_PLATFORM_EXTENSIONS[job.platform] || 'unknown';
    const artifactFilepath = path.join(toDir, `app.${artifactExt}`);
    console.log(`Downloading artifact to ${chalk.underline(artifactFilepath)}`);
    return await downloadFile(job.artifacts.url, artifactFilepath);
}

module.exports = {
    resolveManifestDir,
    buildManifestFilePathFromDir,
    readBuildManifest,
    buildStatus,
    ensureNoInProgressBuilds,
    fetchArtifactJobs,
    ensureNotRunning,
    checkIfBuilt,
    downloadArtifact,
};