import { FabricGateway } from '@medplum/fabric-gateway';
import { MedplumServerConfig } from './config';
import { globalLogger } from './logger';
import fs from "fs/promises";

const gateways: FabricGateway[] = [];
const newRecords: NewRecord[] = [];
const freshNewRecords: NewRecord[] = [];
const wrongNewRecords: NewRecord[] = [];
const accesses: Access[] = [];
const freshAccesses: Access[] = [];
const wrongAccesses: Access[] = [];



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

export function appendNewRecord(record: NewRecord): void {
  freshNewRecords.push(record);

  /*
  if (freshNewRecords.length > 1000) {
    newRecords.splice(0, 1000).forEach(newRecord => verifyWrite(newRecord).catch(err => console.log(err)));
  }
  */
}

export function appendNewAccess(access: Access): void {
  freshAccesses.push(access);

  /*
  if (accesses.length > 1000) {
    accesses.splice(0, 1000).forEach(acc => verifyRead(acc).catch(err => console.log(err)));
  }
  */
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

  setInterval(verifyLedger, 20000);
}

export async function closeFabricGateway(): Promise<void> {
  for (let i = 0; i < gateways.length; i++) {
    await gateways[i].close();
    gateways.splice(i, 1);
  }
}

async function verifyLedger(): Promise<void> {
  console.log('Reviewing requests');

  let len = newRecords.length;
  let freshLen = freshNewRecords.length;
  newRecords.push(...freshNewRecords.splice(0, freshLen));

  for (const newRecord of newRecords.splice(0, len)) {
    try {
      await verifyWrite(newRecord);
    } catch (err) {
      console.log(err);
      wrongNewRecords.push(newRecord);
    }
  }

  len = accesses.length;
  freshLen = freshAccesses.length;
  newRecords.push(...freshNewRecords.splice(0, freshLen));

  for (const newAccess of accesses.splice(0, len)) {
      try {
        await verifyRead(newAccess);
      } catch (err) {
        console.error(err);
        wrongAccesses.push(newAccess);
      }
  }

  const content = wrongAccesses.map(e => JSON.stringify(e)).join('\n')
    + wrongNewRecords.map(e => JSON.stringify(e)).join('\n');
  await fs.appendFile('blacklist.txt', content);
  wrongAccesses.length = 0;
  wrongNewRecords.length = 0;
}

async function verifyWrite(newRecord: NewRecord): Promise<void>  {
  const gateway = getFabricGateway();

  const action = await gateway.readAction(newRecord.actionId);
  if (action === undefined) {
    wrongNewRecords.push(newRecord)
    console.error('Action could not be validated');
    return;
  }

  const record = await gateway.readRecord(newRecord.recordId);
  if (record === undefined) {
    wrongNewRecords.push(newRecord)
    console.error('Record could not be validated');
    return;
  }

  if (newRecord.hash !== record.Hash) {
    wrongNewRecords.push(newRecord);
    //await getSystemRepo().deleteResource(record.ResourceType, newRecord.recordId);
    console.error('Digest of data being stored does not match fabric network digest');
    return;
  }

  console.log(`Record ${newRecord.recordId} validation success`);
}

async function verifyRead(access: Access): Promise<void> {
  const action = await getFabricGateway().readAction(access.actionId);
  if (action === undefined) {
    wrongAccesses.push(access);
    console.error('Action not validated, adding to blacklist');
    return;
  }

  console.log(action);
  console.log(`Access ${access.actionId} validation success`);
}