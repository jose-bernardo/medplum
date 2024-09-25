import { FabricGateway } from '@medplum/fabric-gateway';
import { MedplumServerConfig } from './config';
import { globalLogger } from './logger';

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
  if (newRecords.length > 100) {
    console.log('Many writes, verifying writes...')
    verifyLedger();
  }
}

export function appendNewAccess(access: Access): void {
  accesses.push(access);
  if (accesses.length > 100) {
    console.log('Many reads, verifying reads...')
    verifyLedger();
  }
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

  setInterval(verifyLedger, 60000);
}

export async function closeFabricGateway(): Promise<void> {
  for (let i = 0; i < gateways.length; i++) {
    await gateways[i].close();
    gateways.splice(i, 1);
  }
}

function verifyLedger(): void {
  let len = newRecords.length;
  let i = 0;
  while (i < len) {
    const newRecord= newRecords.shift();
    if (newRecord !== undefined) {
      verifyWrite(newRecord);
    }
    i++;
  }

  len = accesses.length;
  i = 0;
  while (i < len) {
    const newAccess = accesses.shift();
    if (newAccess !== undefined) {
      verifyRead(newAccess);
    }
    i++;
  }
}

function verifyWrite(newRecord: NewRecord): void  {
  const gateway = getFabricGateway();

  const action = gateway.ReadAction(newRecord.actionId);
  if (action === undefined) {
    wrongNewRecords.push(newRecord)
    throw new Error('Action could not be validated');
  }

  const record = gateway.ReadRecord(newRecord.recordId);
  if (record === undefined) {
    wrongNewRecords.push(newRecord)
    throw new Error('Record could not be validated');
  }
  if (newRecord.hash !== record.Hash) {
    wrongNewRecords.push(newRecord);
    //await getSystemRepo().deleteResource(record.ResourceType, newRecord.recordId);
    throw new Error('Digest of data being stored does not match fabric network digest');
  }

  console.log(`Record ${newRecord.recordId} validation success`);
}

function verifyRead(access: Access): void {
  const action = getFabricGateway().ReadAction(access.actionId);
  if (action === undefined) {
    wrongAccesses.push(access);
    throw new Error('Action not validated, adding to blacklist');
  }

  console.log(action);
  console.log(`Access ${access.actionId} validation success`);
}