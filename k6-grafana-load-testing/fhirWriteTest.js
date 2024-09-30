import http from 'k6/http';
import { sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import crypto from 'k6/crypto';
import { generateWebReport, invokeWriteCC } from './util.js';

export const options = {
  vus: __ENV.VUS,
  duration: __ENV.DURATION,
  setupTimeout: '4m'
};

const url = 'http://10.15.0.11:5555';
const token = __ENV.TOKEN;

const fhirParams = {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}

const record = JSON.parse(open('fhir-samples/fhir.json'));
const resourceType = record.resourceType;

export default function() {
  const recordIds = [];
  const hashes = []
  for (let i = 0; i < 20; i++) {
    sleep(Math.random() * 5);
    const recordId = uuidv4();

    record.id = recordId;
    const recordHash = crypto.sha256(JSON.stringify(record), 'hex');
    hashes.push(recordHash);

    let res = http.post(url + `/fhir/R4/${resourceType}`, JSON.stringify(record), fhirParams);
    console.log(res.status);

    recordIds.push(recordId);
  }

  invokeWriteCC(recordIds, hashes);
}