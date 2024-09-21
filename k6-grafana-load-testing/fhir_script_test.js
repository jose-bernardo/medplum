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

function invokeChaincode(recordId, actionId, hash) {
    const command = 'bash'
    const args = ['./invoke.sh', recordId, actionId, hash];

    console.log(exec.command(command, args));
}

export default function() {
    const recordId = uuidv4();
    const actionId = uuidv4();

    if (Math.random() > 2) {
        fhirRecord.id = recordId;
        const resourceType = fhirRecord.resourceType;

        invokeChaincode(recordId, actionId, recordHash);

        sleep(1);

        let res = http.post(url + `/fhir/R4/${resourceType}?actionId=${actionId}`, JSON.stringify(record), fhirParams);
    } else {
        invokeChaincode(recordId, actionId, binaryHash);

        sleep(1);

        let res = http.post(url + `/fhir/R4/Binary?recordId=${recordId}&actionId=${actionId}`, binary, binaryParams);
    }
    console.log(res.status);
}

/*
export function handleSummary(data) {
    return {
        'metrics.json': JSON.stringify(data.metrics, null, 2),  // Save only the metrics
    };
}
*/
