import http from 'k6/http';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import crypto from 'k6/crypto';
import { invokeWriteCC } from './util.js';

export const options = {
  vus: 50,
  duration: '10m',
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

export default function() {
    const recordIds = [];
    const hashes = [];
    for (let i = 0; i < 20; i++) {
      const recordId = uuidv4();

      recordIds.push(recordId);
      hashes.push(binaryHash);

      let res = http.post(url + `/fhir/R4/Binary?recordId=${recordId}`, binary, binaryParams);
      console.log(res.status);
    }

    invokeWriteCC(recordIds, hashes);
}