import { FabricGateway } from '@medplum/fabric';
import { ClientStorage, MedplumClient, sleep } from '@medplum/core';
import { Resource } from '@medplum/fhirtypes';

const medplumClient: MedplumClient = new MedplumClient({
  baseUrl: 'http://10.15.0.17:8103',
  storage: new ClientStorage()
});

const gateway = new FabricGateway();

async function main(): Promise<void> {
  const response = await medplumClient.startLogin({ email: 'admin@example.com', password: 'medplum_admin' })
  console.log(response);

  const resource = {};

  const resourceId = await createResource(resource as Resource);

  await readResource('Patient', resourceId);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function evaluate(nRequests: number, interval: number, iterations: number): Promise<void> {
  while (iterations) {
    for (let i = 0; i < iterations; i++) { /* empty */ }
    await sleep(interval);
    iterations--;
  }
}

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

async function readResource(resourceType: string, resourceId: string) {
  const res1 = await medplumClient.readResource(resourceType, resourceId);
  console.log(res1);

  const res2 = await gateway.recordReadOnLedger(resourceId);
  console.log(res2);
}

main().catch((error: unknown) => {
  console.error('******** FAILED to run the application:', error);
  process.exitCode = 1;
});