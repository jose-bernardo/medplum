import http from 'k6/http';
import { sleep } from 'k6';
import exec from 'k6/x/exec';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import crypto from 'k6/crypto';

export const options = {
  vus: 1,
  duration: '10m',
};

const url = 'http://10.100.0.12:5555';
const token = '';

const SAMPLES_N = 12
const samplesDir = 'fhir-samples'

const fhirParams = {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}


const binaryParams = {
  headers: {
    'Content-Type': 'multipart/form-data',
    'Authorization': 'Bearer ' + token
  }
}

const record = JSON.parse(open('fhir-samples/fhir.json'));
const recordHash = crypto.sha256(JSON.stringify(fhirRecord), 'hex');
const binary = open('fhir-samples/binary.dat');
const binaryHash = crypto.sha256(binary, 'hex');
const generatedRecordIds = [];
const resourceType = record.resourceType;

const resourceIds = Array.from({ length: 900 }, () => uuidv4());
const resourceActionId = uuidv4();
const binaryIds = Array.from({ length: 100}, () => uuidv4());
const binaryActionId = uuidv4();

function invokeWriteCC(recordId, actionId, hash) {
    const command = 'bash'
    const args = ['./invoke.sh', recordId, actionId, hash];

    console.log(exec.command(command, args));
}

function invokeReadCC(recordId, actionId) {
    const command = 'bash'
    const args = ['./invoke.sh', recordId, actionId];

    console.log(exec.command(command, args));
}

function write() {
    const recordId = uuidv4();
    const actionId = uuidv4();

    generatedRecordIds.push(recordId)

    if (Math.random() > 0.2) {
        fhirRecord.id = recordId;

        invokeWriteCC(recordId, actionId, recordHash);

        sleep(2);

        let res = http.post(url + `/fhir/R4/${resourceType}?actionId=${actionId}`, JSON.stringify(record), fhirParams);
        console.log(res.status);
    } else {
        invokeWriteCC(recordId, actionId, binaryHash);

        sleep(2);

        let res = http.post(url + `/fhir/R4/Binary?recordId=${recordId}&actionId=${actionId}`, binary, binaryParams);
        console.log(res.status);
    }
}

function read() {
    const actionId = uuidv4();

    if (Math.random() > 0.3) {
        const idx = Math.floor(Math.random() * resourceIds.length);

        invokeReadCC(idx, actionId);

        sleep(1);

        const res = http.get(url + `/fhir/R4/${resourceType}/${resourceIds[idx]}?actionId=${actionId}`);
        console.log(res.status);
    } else {
        const idx = Math.floor(Math.random() * binaryIds.length);

        invokeReadCC(idx, actionId);

        sleep(1);

        const res = http.get(url + `/fhir/R4/Binary/${binaryIds[idx]}?actionId=${actionId}`);
        console.log(res.status);
    }
}

function setup() {

    const resourceHashes = Array(900).fill(recordHash);
    const binaryHashes = Array(100).fill(binaryHash);

    invokeWriteCC(JSON.stringify(resourceIds), resourceActionId, JSON.stringify(resourceHashes));
    invokeWriteCC(JSON.stringify(binaryIds), binaryActionId, JSON.stringify(binaryHashes));

    sleep(1);

    resourceIds.forEach(_ => {
        let res = http.post(url + `/fhir/R4/${resourceType}?actionId=${resourceActionId}`, JSON.stringify(record), fhirParams);
        console.log(res.status);
    });

    binaryIds.forEach(binaryId => {
        let res = http.post(url + `/fhir/R4/Binary?recordId=${binaryId}&actionId=${binaryActionId}`, binary, binaryParams);
        console.log(res.status);
    });
}

export default function() {
    if (Math.random() > 0.4) {
        read();
    } else {
        write();
    }
}

/*
export function handleSummary(data) {
    return {
        'metrics.json': JSON.stringify(data.metrics, null, 2),  // Save only the metrics
    };
}
*/
