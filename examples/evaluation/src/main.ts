import { FabricGateway } from '@medplum/fabric';
import { MedplumClient } from '@medplum/core';
import { Resource, ResourceType } from '@medplum/fhirtypes';

const medplumClient: MedplumClient = new MedplumClient({
  baseUrl: 'http://10.100.0.12:8103',
  accessToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImVjMjdhMjM2LTQ2MDUtNGY3Zi1iZjQ1LTcwN2VjYWE2MDBlMCIsInR5cCI6IkpXVCJ9.eyJsb2dpbl9pZCI6ImJhMWNjM2Q5LWNlY2EtNGJhNS1hNDgyLWJjOGYwYjBkZWU4MiIsInN1YiI6IjdmMGU0Mjg3LWYwZTEtNDBjNS1hNDk1LTJkM2M0YjE4Mjc3ZiIsInVzZXJuYW1lIjoiN2YwZTQyODctZjBlMS00MGM1LWE0OTUtMmQzYzRiMTgyNzdmIiwic2NvcGUiOiJvcGVuaWQiLCJwcm9maWxlIjoiUHJhY3RpdGlvbmVyL2M2YjcxOTlmLTY4NjAtNDA0My04NjMwLTIzMTU1MTVlNjA3MCIsImlhdCI6MTcyMjk4MDk1NCwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MTAzLyIsImV4cCI6MTcyMjk4NDU1NH0.lIiJ_UGVnAZdguuScE7dgtgXFoEzlO7xy5HFHX00KSh077FWFoHg8HqE__WZWjnvloFwephocCxcC8TZKDUPdjmRLKNJwoKJ07bMyCCnNvNztXbJnYif8bP7v2qudH76RHfG88dXVM8X6r8I4aRf9ukGHvMoul6SrXcXbWymrCOu-rDXYEeG5ooKEoSTWlX1PKr_l_xGNUfksy2W-zGgq4cHwM1oBE-kdC-F1zEZiP8bXYTpLYEoR3N42dqgZ9ckYSY2tliM6Y_J0EAHYWwSVXJf94EdMIQ1zFlYfYJpZwUrW3EYqRa2FGlOuG9DH-fZXA1Vjt6UU9krGgb5z8bQSg'
});

const gateway = new FabricGateway();

async function main(): Promise<void> {

  await gateway.connect();

  const resourceId = await createResource({resourceType: 'Patient'} as Resource);

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

    const res3 = await medplumClient.confirmPendingRequest();
    console.log(res3);

    return res1.id;
  }

  return "";
}

async function readResource(resourceType: ResourceType, resourceId: string): Promise<void> {
  const res1 = await medplumClient.readResource(resourceType, resourceId);
  console.log(res1);

  const res2 = await gateway.recordUpdateOnLedger(resourceId);
  console.log(res2);

  const res3 = await medplumClient.confirmPendingRequest();
  console.log(res3);
}

main().catch((error: unknown) => {
  console.error('******** FAILED to run the application:', error);
  process.exitCode = 1;
});