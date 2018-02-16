const chalk = require('chalk');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const rp = require('request-promise');
const R = require('ramda');
const {
    sleep,
    downloadFile,
} = require('./utils');

const ARTIFACT_PLATFORM_EXTENSIONS = {
    ios: 'ipa',
    android: 'apk',
};

const ARTIFACT_BUILT_TIMEOUT = 60 * 15; // default timeout is 15 mins
const ARTIFACT_SLEEP_TIMEOUT = 60;      // default sleep for 60 seconds

const secondsToMilliseconds = (seconds) => seconds * 1000;

async function readBuildManifest (dir) {
    const filename = path.join(dir, 'app.json');
    const contents = await fs.readFileAsync(filename);
    return JSON.parse(contents).expo;
}

async function buildStatus (projectManifest, expState = {}) {
    const { accessToken, auth = {} } = expState;
    const res = await rp({
        url: 'https://exp.host/--/api/build/[]',
        headers: {
            'Exp-ClientId': accessToken,
            'Authorization': `Bearer ${auth.idToken}`,
            'Exp-Access-Token': auth.accessToken,
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

const isStatusInProgress = R.compose(
    x => x.length > 0,
    R.filter(x => x.status === 'in-progress'),
    R.propOr([], 'jobs')
);

async function ensureNoInProgressBuilds (projectManifest, expState) {
    if (isStatusInProgress(await buildStatus(projectManifest, expState))) {
        return false;
    }
    return true;
}

async function fetchArtifactJobs (projectManifest, expState) {
    const status = await buildStatus(projectManifest, expState);
    const jobs = R.propOr([], 'jobs', status);
    return jobs;
}

async function ensureNotRunning (projectManifest, expState) {
    return await ensureNoInProgressBuilds(projectManifest, expState);
}

async function checkIfBuilt (projectManifest, expState, { timeout = ARTIFACT_BUILT_TIMEOUT, interval = ARTIFACT_SLEEP_TIMEOUT } = {}) {
    let startTime = new Date().getTime();
    const endTime = startTime + secondsToMilliseconds(timeout); // 15 mins
    while (startTime <= endTime) {
        const job = R.head(await fetchArtifactJobs(projectManifest, expState));
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
    if (R.isNil(job.artifacts) || R.isNil(job.artifacts.url)) {
        throw new Error(`No artifact found for job - ${job.id}`);
    }
    const artifactExt = ARTIFACT_PLATFORM_EXTENSIONS[job.platform] || 'unknown';
    const artifactFilepath = path.join(toDir, `app.${artifactExt}`);
    console.log(`Downloading artifact to ${chalk.underline(artifactFilepath)}`);
    return await downloadFile(job.artifacts.url, artifactFilepath);
}

module.exports = {
    readBuildManifest,
    buildStatus,
    ensureNoInProgressBuilds,
    fetchArtifactJobs,
    ensureNotRunning,
    checkIfBuilt,
    downloadArtifact,
};