"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fabric_1 = require("@medplum/fabric");
const core_1 = require("@medplum/core");
const medplumClient = new core_1.MedplumClient({
    baseUrl: 'http://10.15.0.17:8103',
});
const gateway = new fabric_1.FabricGateway();
async function main() {
    const response = await medplumClient.startLogin({ email: 'admin@example.com', password: 'medplum_admin' });
    console.log(response);
    const resource = {};
    return;
    const resourceId = await createResource(resource);
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
async function createResource(resource) {
    const res1 = await medplumClient.createResource(resource);
    console.log(res1);
    if (res1.id !== undefined) {
        const res2 = await gateway.recordUpdateOnLedger(res1.id);
        console.log(res2);
        return res1.id;
    }
    return "";
}
async function readResource(resourceType, resourceId) {
    const res1 = await medplumClient.readResource(resourceType, resourceId);
    console.log(res1);
    const res2 = await gateway.recordUpdateOnLedger(resourceId);
    console.log(res2);
}
main().catch((error) => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});
//# sourceMappingURL=main.js.map