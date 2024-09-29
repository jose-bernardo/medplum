import http from 'k6/http';
import exec from 'k6/x/exec';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { sleep } from 'k6';
import crypto from 'k6/crypto';

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

function invokeWriteCC(recordId, hash) {
    const command = 'bash'
    const args = ['./invoke.sh', 'CreateRecord', recordId, hash];

    console.log(exec.command(command, args));
}

function write() {
    const recordId = uuidv4();

    invokeWriteCC(recordId, binaryHash);

    let res = http.post(url + `/fhir/R4/Binary?recordId=${recordId}`, binary, binaryParams);
    console.log(res.status);
}

export function setup() {
    sleep(120);
}

export default function() {
    sleep(Math.random() * 60);
    write();
}