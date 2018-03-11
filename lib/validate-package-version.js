const isEmpty = require('lodash/isEmpty');
const packageJson = require('package-json');
const semver = require('semver');

async function validatePackageVersion ({ name, currentVersion }) {
    if (isEmpty(name)) {
        throw new Error('Please provide a valid package name');
    }
    const npmPackage = await packageJson(name);
    const npmVersion = npmPackage.version;
    return {
        isOutdated: semver.lt(currentVersion, npmVersion),
        currentVersion,
        npmVersion,
        npmPackage,
    };
}

module.exports = validatePackageVersion;
