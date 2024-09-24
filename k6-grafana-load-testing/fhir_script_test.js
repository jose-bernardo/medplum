import http from 'k6/http';
import { sleep } from 'k6';
import exec from 'k6/x/exec';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import crypto from 'k6/crypto';
import {  SharedArray } from 'k6/data';

export const options = {
  vus: 150,
  duration: '10m',
};

const url = 'http://10.100.0.12:5555';
const token = '';

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
const binary = open('fhir-samples/binary.dat');
const binaryHash = crypto.sha256(binary, 'hex');
const resourceType = record.resourceType;

const resourceIds = new SharedArray('resource ids', () => Array.from({ length: 45 }, () => uuidv4()));
const binaryIds = new SharedArray('binary ids', () => Array.from({ length: 5}, () => uuidv4()));

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

    if (Math.random() > 0.2) {
        record.id = recordId;
        const recordHash = crypto.sha256(JSON.stringify(record), 'hex');
        invokeWriteCC(recordId, actionId, recordHash);

        sleep(5);

        let res = http.post(url + `/fhir/R4/${resourceType}?actionId=${actionId}`, JSON.stringify(record), fhirParams);
        console.log(res.status);
    } else {
        invokeWriteCC(recordId, actionId, binaryHash);

        sleep(5);

        let res = http.post(url + `/fhir/R4/Binary?recordId=${recordId}&actionId=${actionId}`, binary, binaryParams);
        console.log(res.status);
    }
}

function read() {
    const actionId = uuidv4();

    if (Math.random() > 0.2) {
        const idx = Math.floor(Math.random() * resourceIds.length);

        invokeReadCC(resourceIds[idx], actionId);

        sleep(5);

        const res = http.get(url + `/fhir/R4/${resourceType}/${resourceIds[idx]}?actionId=${actionId}`, fhirParams);
        console.log(res.status);
    } else {
        const idx = Math.floor(Math.random() * binaryIds.length);

        invokeReadCC(binaryIds[idx], actionId);

        sleep(5);

        const res = http.get(url + `/fhir/R4/Binary/${binaryIds[idx]}?actionId=${actionId}`, binaryParams);
        console.log(res.status);
    }
}

export function setup() {
    for (let i = 0; i < resourceIds.length; i++) {
        const actionId = uuidv4();
        record.id = resourceIds[i];
        const recordHash = crypto.sha256(JSON.stringify(record), 'hex');
        invokeWriteCC(resourceIds[i], actionId, recordHash);

        sleep(0.2);

        let res = http.post(url + `/fhir/R4/${resourceType}?actionId=${actionId}`, JSON.stringify(record), fhirParams);
        console.log(res.status);
    }

    for (let i = 0; i < binaryIds.length; i++) {
        const actionId = uuidv4();
        invokeWriteCC(binaryIds[i], actionId, binaryHash);

        sleep(0.2);

        let res = http.post(url + `/fhir/R4/Binary?recordId=${binaryIds[i]}&actionId=${actionId}`, binary, binaryParams);
        console.log(res.status);
    }
}

export default function() {
    if (Math.random() > 0.4) {
        console.log('Read');
        read();
    } else {
        console.log('Write');
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
