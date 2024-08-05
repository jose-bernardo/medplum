import { FabricGateway } from '@medplum/fabric';
import { MedplumClient } from '@medplum/core';
import { Resource, ResourceType } from '@medplum/fhirtypes';

const medplumClient: MedplumClient = new MedplumClient({
  baseUrl: 'http://10.15.0.17:8103',
});

const gateway = new FabricGateway();

async function main(): Promise<void> {

  const resource = {};

  return;
  const resourceId = await createResource(resource as Resource);

  await readResource('Patient', resourceId);
}

/*
async function evaluate(nRequests: number, interval: number, iterations: number): Promise<void> {
  while (iterations) {
    for (let i = 0; i < iterations; i++) {  }
    await sleep(interval);
    iterations--;
  }
}
*/

async function createResource(resource: Resource): Promise<string> {
  const res1= await medplumClient.createResource(resource);
  console.log(res1);

  if (res1.id !== undefined) {
    const res2 = await gateway.recordUpdateOnLedger(res1.id);
    console.log(res2);

    return res1.id;
  }

  return "";
}

async function readResource(resourceType: ResourceType, resourceId: string): Promise<void> {
  const res1 = await medplumClient.readResource(resourceType, resourceId);
  console.log(res1);

  const res2 = await gateway.recordUpdateOnLedger(resourceId);
  console.log(res2);
}

main().catch((error: unknown) => {
  console.error('******** FAILED to run the application:', error);
  process.exitCode = 1;
});