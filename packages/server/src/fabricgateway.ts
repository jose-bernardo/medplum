import { FabricGateway } from '@medplum/fabric-gateway';
import { MedplumServerConfig } from './config';
import { globalLogger } from './logger';
import {getSystemRepo} from "./fhir/repo";
import {ResourceType} from "@medplum/fhirtypes";

const gateways: FabricGateway[] = [];
const matureWriteOps: (NewRecord)[] = [];
const freshWriteOps: (NewRecord)[] = [];
const matureReadOps: (Access)[] = [];
const freshReadOps: (Access)[] = [];

const chunkSize = 5;

interface NewRecord {
  recordId: string
  requestor: string
  resourceType: string
  hash: string
  blReason?: string
}

interface Access {
  accessId: string
  recordId: string
  requestor: string
  resourceType: string
  blReason?: string
}

export function getFabricGateway(): FabricGateway {
  const idx = Math.floor(Math.random() * gateways.length);
  if (gateways[idx] === undefined) {
    throw new Error("Fabric Gateway not setup");
  }
  return gateways[idx];
}

export function appendNewRecord(op: NewRecord): void {
  freshWriteOps.push(op);
}

export function appendNewAccess(op: Access): void {
  freshReadOps.push(op);
}

export async function initFabricGateway(serverConfig: MedplumServerConfig): Promise<void> {
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

  setInterval(verifyLedger, 5000);
}

export async function closeFabricGateway(): Promise<void> {
  for (let i = 0; i < gateways.length; i++) {
    await gateways[i].close();
    gateways.splice(i, 1);
  }
}

async function verifyLedger(): Promise<void> {
  matureWriteOps.push(...freshWriteOps.splice(0, freshWriteOps.length));
  for (let i = 0; i < matureWriteOps.length; i += chunkSize) {
    const chunk = matureWriteOps.splice(i, i + chunkSize);
    await verifyWriteChunk(chunk);
  }

  matureReadOps.push(...freshReadOps.splice(0, freshReadOps.length));
  for (let i = 0; i < matureReadOps.length; i += chunkSize) {
    const chunk = matureReadOps.splice(i, i + chunkSize);
    await verifyReadChunk(chunk);
  }
}

async function verifyWriteChunk(newRecords: NewRecord[]): Promise<void> {
  const recordIds = newRecords.map((record) => record.recordId);
  const ledgerChunk: JSON[] = getFabricGateway().readRecords(recordIds);
  console.log('Verifying write chunk');
  for (let i = 0; i < newRecords.length; i++) {
    const newRecord = newRecords[i]
    try {
      await verifyWrite(newRecord, ledgerChunk[i]);
    } catch (err) {
      if (!newRecord.blReason) {
        newRecord.blReason = JSON.stringify(err);
      }
      //await getFabricGateway().logBadAction(randomUUID(), newRecord.blReason);
    }
  }
}

async function verifyReadChunk(newAccesses: Access[]): Promise<void> {
  const recordIds = newAccesses.map((access) => access.accessId);
  const ledgerChunk: JSON[] = getFabricGateway().readAccesses(recordIds);
  console.log('Verifying read chunk');
  for (let i = 0; i < newAccesses.length; i++) {
    const newAccess = newAccesses[i];
    try {
      await verifyRead(newAccess, ledgerChunk[i]);
    } catch (err) {
      console.log(err);
      if (!newAccess.blReason) {
        newAccess.blReason = JSON.stringify(err);
      }
      //await getFabricGateway().logBadAction(randomUUID(), newAccess.blReason);
    }
  }
}

async function verifyWrite(newRecord: NewRecord, record: any): Promise<void>  {
  if (record === '') {
    newRecord.blReason = `Record ${newRecord.recordId} not found`;
    throw new Error(`Record ${newRecord.recordId} not found`);
  }

  if (newRecord.hash !== record.Hash) {
    newRecord.blReason = `Record ${newRecord.recordId} hash does not match`;
    await getSystemRepo().deleteResource(newRecord.resourceType as ResourceType, newRecord.recordId);
    throw new Error(`Record ${newRecord.recordId} hash does not match`);
  }

  console.log(`Record ${newRecord.recordId} validation success`);
}

async function verifyRead(newAccess: Access, accessLog: any): Promise<void> {
  if (accessLog === '') {
    newAccess.blReason = `Access ${newAccess.accessId} not found`;
    throw new Error(`Access ${newAccess.accessId} not found`);
  }

  console.log(`Access ${newAccess.accessId} validation success`);
}