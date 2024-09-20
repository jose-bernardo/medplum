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
const token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImIzOWI0MTI2LWRlZGEtNDFiYi05ZmFjLTgxODhmZjNjMWZmYiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJtZWRwbHVtLWNsaSIsImxvZ2luX2lkIjoiYmJmZWQxYmMtNzg0Yi00N2Y4LTgzOGMtZjVjYmQ0MmQ0MTc4Iiwic3ViIjoiNzMxYmQ1NzktOGY2My00MGI4LTgwMWYtNDk4MWExNGZiNDVjIiwidXNlcm5hbWUiOiI3MzFiZDU3OS04ZjYzLTQwYjgtODAxZi00OTgxYTE0ZmI0NWMiLCJzY29wZSI6Im9wZW5pZCIsInByb2ZpbGUiOiJQcmFjdGl0aW9uZXIvM2RjODZhZDktZTE5YS00Y2QxLWIyMzItODdkODJiNjM0ZDM4IiwiaWF0IjoxNzI2NjU5NjgyLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjU1NTUvIiwiYXVkIjoibWVkcGx1bS1jbGkiLCJleHAiOjE3MjY2NjMyODJ9.mGAJyA6mOQ4MZmHPWDExeFXhvX0CuwwVVDe9zJuowrcS2essueHrmyWDtzdxme-is-3CV50JweE5u2qm-n_LFeGL_HkhO4J7uJnbWTLGTLu4OGeLS5sCxn1lJd1ii8Z87s801Ru9U2tF-JkgFNKc0Q0wavsmcJ5OUhgpLt8O2q0j2JIgv9enkNEX8lcTTtHNOLzMFsGWYNsyp1RfRbqrpBBaIsPx0WAuRfAeVXotiXL1AN8CS6P-pl7f3VXN5nwN0BXB6EYa82UrW80NGUYNl58jfgtn-KuUuSisEyC56L08_Ao1sJrVmYq6aHTTA6SeF0DXrdsgjj2g5Lxva6WSzQ';

const SAMPLES_N = 12
const samplesDir = 'fhir-samples'

const params = {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}

const records = []
for (let i = 1; i < SAMPLES_N; i++) {
    records.push(JSON.parse(open(samplesDir + '/' + (i + 1) + '.json')))
}

export default function() {
    const fhirIdx = Math.floor(Math.random() * SAMPLES_N);
    const recordId = uuidv4();
    const actionId = uuidv4();

    const fhirRecord = records[fhirIdx];
    fhirRecord.id = recordId;
    const resourceType = fhirRecord.resourceType;

    const hash = crypto.sha256(JSON.stringify(fhirRecord), 'hex');

    const command = 'bash'
    const args = ['./invoke.sh', recordId, actionId, hash];

    console.log(exec.command(command, args));

    sleep(1);

    let res = http.post(url + `/fhir/R4/${resourceType}?actionId=${actionId}`, JSON.stringify(fhirRecord), params);
    console.log(res.status);
}

/*
export function handleSummary(data) {
    return {
        'metrics.json': JSON.stringify(data.metrics, null, 2),  // Save only the metrics
    };
}
*/