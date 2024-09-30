import http from 'k6/http';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import crypto from 'k6/crypto';
import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { invokeWriteCC, invokeReadCC, generateWebReport } from './util.js';

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
const resourceIds = new SharedArray('resource ids', () => Array.from({ length: 500 }, () => uuidv4()));

export function setup() {
  const recordHashes = [];
  for (const recordId of resourceIds) {
    record.id = recordId;

    const recordHash = crypto.sha256(JSON.stringify(record), 'hex');
    recordHashes.push(recordHash);

    let res = http.post(url + `/fhir/R4/${resourceType}`, JSON.stringify(record), fhirParams);
    console.log(res.status);
  }

  invokeWriteCC(resourceIds, recordHashes);
}

export default function() {
  const recordIds = [];
  const accessId = uuidv4();

  for (let i = 0; i < 20; i++) {
    sleep(Math.random() * 3);
    const idx = Math.floor(Math.random() * resourceIds.length);
    recordIds.push(resourceIds[idx]);

    const res = http.get(url + `/fhir/R4/${resourceType}/${resourceIds[idx]}?accessId=${accessId}`, fhirParams);
    console.log(res.status);
  }

  invokeReadCC(recordIds, accessId);
}