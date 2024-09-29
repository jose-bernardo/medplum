import http from 'k6/http';
import exec from 'k6/x/exec';
import { sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

export const options = {
  vus: 25,
  duration: '10m',
  setupTimeout: '4m'
};

const url = 'http://10.15.0.11:5555';
const token = process.env.TOKEN;

const fhirParams = {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}

const record = JSON.parse(open('fhir-samples/fhir.json'));
const resourceType = record.resourceType;

function invokeWriteCC(recordIds, hashes) {
  const encRecordIds = encoding.b64encode(JSON.stringify(recordIds));
  const encHashes = encoding.b64encode(JSON.stringify(hashes));

  const command = 'bash'
  const args = ['./invoke.sh', 'CreateRecord', encRecordIds, encHashes];

  console.log(exec.command(command, args));
}

export default function() {
  const recordIds = [];
  const hashes = []
  for (let i = 0; i < 20; i++) {
    sleep(Math.random() * 5);
    const recordId = uuidv4();

    record.id = recordId;
    const recordHash = crypto.sha256(JSON.stringify(record), 'hex');
    invokeWriteCC(recordId, recordHash);

    let res = http.post(url + `/fhir/R4/${resourceType}`, JSON.stringify(record), fhirParams);
    console.log(res.status);

    recordIds.push(recordId);
  }

  invokeWriteCC(recordIds, hashes);
}