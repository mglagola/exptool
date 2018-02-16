const path = require('path');
const fs = require('fs');
const https = require('https');

const resolveHome = (filepath = '~/') => filepath[0] === '~'
    ? path.join(process.env.HOME, filepath.slice(1))
    : filepath;

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function downloadFile (url, writeFilePath) {
    const file = fs.createWriteStream(writeFilePath);
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            const len = parseInt(res.headers['content-length'], 10);
            let downloaded = 0;
            res.on('data', function(chunk) {
                file.write(chunk);
                downloaded += chunk.length;
                process.stdout.write(`Progress: ${(100.0 * downloaded / len).toFixed(2)}% ${downloaded} bytes \r`);
            }).on('end', function () {
                file.end();
                return resolve(writeFilePath);
            }).on('error', reject);           
        }).on('error', reject);
    });
}

async function readJSONfile (path) {
    const contents = await fs.readFileAsync(path);
    return JSON.parse(contents);
}

module.exports = {
    sleep,
    resolveHome,
    downloadFile,
    readJSONfile,
};
