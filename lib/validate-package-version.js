const R = require('ramda');
const packageJson = require('package-json');
const semver = require('semver');

const isEmptyOrNil = (x) => R.isNil(x) || R.isEmpty(x);

async function validatePackageVersion ({ name, currentVersion }) {
    if (isEmptyOrNil(name)) {
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
