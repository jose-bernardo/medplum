import http from 'k6/http';
import exec from 'k6/x/exec';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import crypto from 'k6/crypto';
import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import encoding from 'k6/encoding';

export const options = {
  vus: 50,
  duration: '10m',
  setupTimeout: '4m'
};

const url = 'http://10.15.0.11:5555';
const token = process.env.TOKEN;

const binaryParams = {
  headers: {
    'Content-Type': 'multipart/form-data',
    'Authorization': 'Bearer ' + token
  }
}

const binary = open('fhir-samples/binary.dat');
const binaryHash = crypto.sha256(binary, 'hex');

const binaryIds = new SharedArray('binary ids', () => Array.from({ length: 20}, () => uuidv4()));

function invokeWriteCC(recordIds, hashes) {
  const encRecordIds = encoding.b64encode(JSON.stringify(recordIds));
  const encHashes = encoding.b64encode(JSON.stringify(hashes));

  const command = 'bash'
  const args = ['./invoke.sh', 'CreateRecord', encRecordIds, encHashes];

  console.log(exec.command(command, args));
}

function invokeReadCC(recordIds, accessId) {
  const encRecordIds = encoding.b64encode(JSON.stringify(recordIds));

  const command = 'bash'
    const args = ['./invoke.sh', 'ReadRecordTx', encRecordIds, accessId];

    console.log(exec.command(command, args));
}

export function setup() {
  const hashes = []
  for (const binaryId of binaryIds) {
    hashes.push(binaryHash);
    let res = http.post(url + `/fhir/R4/Binary?recordId=${binaryId}`, binary, binaryParams);
    console.log(res.status);
  }

  invokeWriteCC(binaryIds, hashes);
}

export default function() {
  const accessId = uuidv4();
  const recordIds = [];

  for (let i = 0; i < 20; i++) {
    sleep(Math.random() * 30)
    const idx = Math.floor(Math.random() * binaryIds.length);
    recordIds.push(binaryIds[idx]);

    const res = http.get(url + `/fhir/R4/Binary/${binaryIds[idx]}?accessId=${accessId}`, binaryParams);
    console.log(res.status);
  }

  invokeReadCC(recordIds, accessId);
}