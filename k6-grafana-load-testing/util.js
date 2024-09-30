import exec from 'k6/x/exec';
import encoding from 'k6/encoding';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

export function invokeWriteCC(recordIds, hashes) {
  const encRecordIds = encoding.b64encode(JSON.stringify(recordIds));
  const encHashes = encoding.b64encode(JSON.stringify(hashes));

  const command = 'bash'
  const args = ['./invoke.sh', 'CreateRecords', encRecordIds, encHashes];

  console.log(exec.command(command, args));
}

export function invokeReadCC(recordIds, accessId) {
  const encRecordIds = encoding.b64encode(JSON.stringify(recordIds));

  const command = 'bash'
  const args = ['./invoke.sh', 'ReadRecordsTx', encRecordIds, accessId];

  exec.command(command, args);
}

export function generateWebReport(filename, data) {
  return {
    filename: htmlReport(data),
  };
}