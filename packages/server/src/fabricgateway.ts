import { FabricGateway } from '@medplum/fabric-gateway';
import { MedplumServerConfig } from './config';
import { globalLogger } from './logger';
import {getSystemRepo} from "./fhir/repo";
import {ResourceType} from "@medplum/fhirtypes";
import {randomUUID} from "crypto";

const gateways: FabricGateway[] = [];
const newRecords: NewRecord[] = [];
const freshNewRecords: NewRecord[] = [];

interface NewRecord {
  recordId: string
  requestor: string
  actionId: string
  resourceType: string
  hash?: string
  blReason?: string
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

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      if (freshNewRecords.length > 100) {
        console.log('Reviewing requests');
        await verifyLedger();
      } else {
        console.log('Waiting for more requests');
        await new Promise(f => {
          setTimeout(f, 20000)
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
}

export async function closeFabricGateway(): Promise<void> {
  for (let i = 0; i < gateways.length; i++) {
    await gateways[i].close();
    gateways.splice(i, 1);
  }
}

async function verifyLedger(): Promise<void> {
  const len = newRecords.length;
  const freshLen = freshNewRecords.length;
  newRecords.push(...freshNewRecords.splice(0, freshLen));

  for (const newRecord of newRecords.splice(0, len)) {
    try {
      if (newRecord.recordId !== undefined) {
        await verifyWrite(newRecord);
      } else {
        await verifyRead(newRecord);
      }
    } catch (err) {
      console.log(err);
      await getFabricGateway().logBadAction(
        randomUUID(), newRecord.requestor, newRecord.recordId, newRecord.actionId, newRecord.blReason);
    }
  }
}

async function verifyWrite(newRecord: NewRecord): Promise<void>  {
  const gateway = getFabricGateway();

  const action = await gateway.readAction(newRecord.actionId);
  if (action === undefined) {
    newRecord.blReason = 'action id not found';
    throw new Error('Action could not be validated');
  }

  const record = await gateway.readRecord(newRecord.recordId);
  if (record === undefined) {
    newRecord.blReason = 'record id not found';
    throw new Error('Record could not be validated');
  }

  if (newRecord.hash !== record.Hash) {
    newRecord.blReason = 'hash does not match';
    await getSystemRepo().deleteResource(newRecord.resourceType as ResourceType, newRecord.recordId);
    throw new Error('Digest of data being stored does not match fabric network digest');
  }

  console.log(`Record ${newRecord.recordId} validation success`);
}

async function verifyRead(access: NewRecord): Promise<void> {
  const action = await getFabricGateway().readAction(access.actionId);
  if (action === undefined) {
    access.blReason = 'action id not found';
    throw new Error('Action not validated, adding to blacklist');
  }

  console.log(action);
  console.log(`Access ${access.actionId} validation success`);
}