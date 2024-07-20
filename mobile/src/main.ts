import * as path from 'path';

import * as console from 'node:console';
import { MedplumClient } from '@medplum/core';
import { Resource } from '@medplum/fhirtypes';

const baseUrl = 'http://10.15.0.17:8103'

const jwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImFlNTJjYjZkLTc0M2UtNGNlNC05NjU3LTE0ZWVmNjZmZTZiOSIsInR5cCI6IkpXVCJ9.eyJsb2dpbl9pZCI6IjBlODczYjA4LTM1YjUtNGU3ZS05OTUyLWVkZWI1NTE5ZmZmYyIsInN1YiI6IjQyMDk2MGIxLTQzY2MtNDNmNC1hOTdmLWYzY2Q5ZTg0MTdiZSIsInVzZXJuYW1lIjoiNDIwOTYwYjEtNDNjYy00M2Y0LWE5N2YtZjNjZDllODQxN2JlIiwic2NvcGUiOiJvcGVuaWQiLCJwcm9maWxlIjoiUHJhY3RpdGlvbmVyL2YwMzVlMWU5LTFjNTEtNDVmZS05ZjEyLTdhZGE1ODgwZWM0YiIsImlhdCI6MTcyMTMzMDEyMywiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MTAzLyIsImV4cCI6MTcyMTMzMzcyM30.CIW6LDLUomC3wwi1swSJXbsu_YbkJWRHWsbSEJqjFhQnDC4tZfZ6CB1H7bMx5Adi0qJZuVa3hynQ4FIHGERcJ2P9uy3UgF3np7Vq8V3_EsvoW1A82_qFHJ8-G-JdZGnFGRTCx1EgMoTUurHx6gOsUyUFN_03USn9ahi0lJSmHbQ_TZKwACaMP-WArF5Wbgu0QKkedvQywTC-u5VGjYBL0tzVg1P5W4--NSzUM9btUkUhjmxdfEZ4nqbescjnzSXTAvRn_QB91j21_6wL1J3XYiIEq8nyzAA5jOVMjyvogKnINeAIxkQHCyyMneM1uaWkgH7DTyYnmGwYLpyhxZOrUA'

const medplum = new MedplumClient({
  baseUrl: baseUrl,
  fhirUrlPath: 'http://10.15.0.17:8103/fhir/R4/',
  accessToken: jwt
});

async function main(): Promise<void> {

    const response = await getPendingRequests();
    console.log(response);
    response.requests.forEach((request: string) => {console.log(request)});
    const status = await confirmPendingRequest();
    console.log(status);

    //await createResource();
}

main().catch(error => {
  console.error('******** FAILED to run the application:', error);
  process.exitCode = 1;
});

/*
async function loadResource(path: string): Promise<Resource> {
  const data= await fs.readFile(path);
  return JSON.parse(data.toString('utf8'));
}
*/

async function updateResource(contract: Contract, resourceId: string): Promise<void> {
  try {
      const hash = await sha256(JSON.stringify(resource));
      const buffer = (await newIdentity()).credentials;
      const cert = buffer.toString();
      await createResourceHF(contract, resourceId, cert, cert, hash);

      return Promise.resolve();
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }
}

async function readResource(contract: Contract, resourceId: string): Promise<void> {
  try {
    return await readResourceByID(contract, resourceId);
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }
}

async function deleteResource(contract: Contract, resourceType: ResourceType, resourceId: string): Promise<void> {
  try {
    await deleteResourceHF(contract, resourceId);
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }

  try {
    await fs.unlink(path.resolve(mountDirectoryPath, resourceId + '.json'))
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }

  return await medplum.deleteResource(resourceType, resourceId)
}

/**
 * Create EHR transaction
 */
async function createResourceHF(contract: Contract, id: string, to: string, from: string, hash: string): Promise<void> {
  console.log('\n--> Submit Transaction: CreateEHR');

  await contract.submitTransaction(
    'CreateEHR',
    id,
    hash
  );

  console.log('*** Transaction committed successfully');
}

/**
 * Mark an EHR as deleted
 */
async function deleteResourceHF(contract: Contract, id: string): Promise<void> {
  console.log('\n--> Submit Transaction: DeleteEHR');

  await contract.submitTransaction('DeleteEHR', id);

  console.log('*** Transaction commited successfully');
}

async function readResourceByID(contract: Contract, id: string): Promise<JSON> {
  console.log('\n--> Submit Transaction: ReadEHRByID, function returns EHR attributes');

  const resultBytes = await contract.submitTransaction('ReadEHR', id);

  const resultJson = utf8Decoder.decode(resultBytes);
  const result = JSON.parse(resultJson);
  console.log('*** Result:', result);
  console.log('*** Transaction committed successfully');

  return result;
}