import { FabricGateway } from '@medplum/fabric-gateway';
import { MedplumServerConfig } from './config';
import { globalLogger } from './logger';
import fs from "fs/promises";

const gateways: FabricGateway[] = [];
const newRecords: NewRecord[] = [];
const accesses: Access[] = [];
const wrongAccesses: Access[] = [];
const wrongNewRecords: NewRecord[] = [];

interface NewRecord {
  recordId: string
  actionId: string
  hash: string
}

interface Access {
  actionId: string
}

export function getFabricGateway(): FabricGateway {
  const idx = Math.floor(Math.random() * gateways.length);
  if (gateways[idx] === undefined) {
    throw new Error("Fabric Gateway not setup");
  }
  return gateways[idx];
}

export function appendNewRecord(recordId: NewRecord): void {
  newRecords.push(recordId);
}

export function appendNewAccess(access: Access): void {
  accesses.push(access);
}

export function initFabricGateway(serverConfig: MedplumServerConfig): void {
  const config1 = serverConfig.fabric[0];

  const gateway1 = new FabricGateway(config1);

  globalLogger.info(gateway1.displayFabricParameters());

  gateway1.connect().then().catch((err: Error) => {
    globalLogger.error("Fabric network connection error: " + err);
  })

  const config2 = serverConfig.fabric[1];

  const gateway2 = new FabricGateway(config2);

  globalLogger.info(gateway2.displayFabricParameters());

  gateway2.connect().then().catch((err: Error) => {
    globalLogger.error("Fabric network connection error: " + err);
  })

  const config3 = serverConfig.fabric[2];

  const gateway3 = new FabricGateway(config3);

  globalLogger.info(gateway3.displayFabricParameters());

  gateway3.connect().then().catch((err: Error) => {
    globalLogger.error("Fabric network connection error: " + err);
  })

  gateways.push(gateway1, gateway2, gateway3);

  setInterval(verifyLedger, 10000);
}

export async function closeFabricGateway(): Promise<void> {
  for (let i = 0; i < gateways.length; i++) {
    await gateways[i].close();
    gateways.splice(i, 1);
  }
}

async function verifyLedger(): Promise<void> {
  let len = newRecords.length;
  let i = 0;
  while (i < len) {
    const newRecord= newRecords.shift();
    if (newRecord !== undefined) {
      await verifyWrite(newRecord);
    }
    i++;
  }

  len = accesses.length;
  i = 0;
  while (i < len) {
    const newAccess = accesses.shift();
    if (newAccess !== undefined) {
      await verifyRead(newAccess);
    }
    i++;
  }

  const content = wrongAccesses.join('\n');
  await fs.appendFile('blacklist.txt', content);
  wrongAccesses.length = 0;
}

async function verifyWrite(newRecord: NewRecord): Promise<void>  {
  const gateway = getFabricGateway();

  const action = await gateway.readAction(newRecord.actionId);
  if (action === undefined) {
    wrongNewRecords.push(newRecord)
    console.err('Action could not be validated');
  }

  const record = await gateway.readRecord(newRecord.recordId);
  if (record === undefined) {
    wrongNewRecords.push(newRecord)
    console.err('Record could not be validated');
  }

  if (newRecord.hash !== record.Hash) {
    wrongNewRecords.push(newRecord);
    //await getSystemRepo().deleteResource(record.ResourceType, newRecord.recordId);
    console.err('Digest of data being stored does not match fabric network digest');
  }

  console.log(`Record ${newRecord.recordId} validation success`);
}

async function verifyRead(access: Access): Promise<void> {
  const action = await getFabricGateway().readAction(access.actionId);
  if (action === undefined) {
    wrongAccesses.push(access);
    console.err('Action not validated, adding to blacklist');
  }

  console.log(action);
  console.log(`Access ${access.actionId} validation success`);
}