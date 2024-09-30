import http from 'k6/http';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import crypto from 'k6/crypto';
import { SharedArray } from 'k6/data';
import { invokeWriteCC, invokeReadCC } from './util.js';

export const options = {
  vus: __ENV.VUS,
  duration: __ENV.DURATION,
  setupTimeout: '4m'
};

const url = 'http://10.15.0.11:5555';
const token = __ENV.TOKEN;

const binaryParams = {
  headers: {
    'Content-Type': 'multipart/form-data',
    'Authorization': 'Bearer ' + token
  }
}

const binary = open('fhir-samples/binary.dat');
const binaryHash = crypto.sha256(binary, 'hex');

const binaryIds = new SharedArray('binary ids', () => Array.from({ length: 30}, () => uuidv4()));

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

  for (let i = 0; i < 1; i++) {
    const idx = Math.floor(Math.random() * binaryIds.length);
    recordIds.push(binaryIds[idx]);

    const res = http.get(url + `/fhir/R4/Binary/${binaryIds[idx]}?accessId=${accessId}`, binaryParams);
    console.log(res.status);
  }

  invokeReadCC(recordIds, accessId);
}