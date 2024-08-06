import { FabricGateway } from '@medplum/fabric';
import { MedplumClient } from '@medplum/core';
import { Resource, ResourceType } from '@medplum/fhirtypes';

const medplumClient: MedplumClient = new MedplumClient({
  baseUrl: 'http://10.100.0.12:8103',
  accessToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImVjMjdhMjM2LTQ2MDUtNGY3Zi1iZjQ1LTcwN2VjYWE2MDBlMCIsInR5cCI6IkpXVCJ9.eyJsb2dpbl9pZCI6ImZhYTllMzY0LTUwNDYtNGJlMC1iMmMxLTZiNGNkYzAzZThmOSIsInN1YiI6IjdmMGU0Mjg3LWYwZTEtNDBjNS1hNDk1LTJkM2M0YjE4Mjc3ZiIsInVzZXJuYW1lIjoiN2YwZTQyODctZjBlMS00MGM1LWE0OTUtMmQzYzRiMTgyNzdmIiwic2NvcGUiOiJvcGVuaWQiLCJwcm9maWxlIjoiUHJhY3RpdGlvbmVyL2M2YjcxOTlmLTY4NjAtNDA0My04NjMwLTIzMTU1MTVlNjA3MCIsImlhdCI6MTcyMjkzMDQ5NCwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MTAzLyIsImV4cCI6MTcyMjkzNDA5NH0.juxbN6-D4WEOsSVyq1mXuGRNCw20mNEyneBxRxvpQPv68wLrp8LVEx2Ea6VAYopVu2XnLxlVhxTf4NL-70o6lP_Kj9rYyd3QQU_g72d5ky1Q17U9zo8duwraQFux-Wy9yfn0zTdN35E4WFjjlv6Bha4ai_nciHtc0_NsvIjtpVEwlhRkvvAfoJZRdGLQM1X9hoFnIBbR4y9Pm-YdfiLmaDmWTje0YipB0p3P_J-7GLB3CnMJ7EHBcFn7HlClXztDI1j256Ks1bnQJGxrqBZjlt-qesy8bzwRLRUuabYWvAuUrQisr8T1HZIa2HitoWljB2g9ZzdvuT050NeBfYYIxQ'
});

const gateway = new FabricGateway();

async function main(): Promise<void> {

  await gateway.start();
  await gateway.setContract();

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