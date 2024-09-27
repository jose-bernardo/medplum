import { FabricGateway } from '@medplum/fabric-gateway';
import { MedplumServerConfig } from './config';
import { globalLogger } from './logger';
import {getSystemRepo} from "./fhir/repo";
import {ResourceType} from "@medplum/fhirtypes";
import {randomUUID} from "crypto";

const gateways: FabricGateway[] = [];
const matureOps: (NewRecord|Access)[] = [];
const freshOps: (NewRecord|Access)[] = [];

interface NewRecord {
  recordId: string
  requestor: string
  resourceType: string
  hash: string
  blReason?: string
}

interface Access {
  accessId: string
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

export function appendNewRecord(op: NewRecord|Access): void {
  freshOps.push(op);
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
      if (freshOps.length > 1000) {
        console.log('Reviewing requests');
        await verifyLedger();
      } else {
        console.log('Waiting for more requests');
        await new Promise(f => {
          setTimeout(f, 60000)
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
  const len = matureOps.length;
  const freshLen = freshOps.length;
  matureOps.push(...freshOps.splice(0, freshLen));

  for (const op of matureOps.splice(0, len)) {
    try {
      if ('hash' in op) {
        await verifyWrite(op as NewRecord);
      } else {
        await verifyRead(op as Access);
      }
    } catch (err) {
      console.log(err);
      if (!op.blReason) {
        op.blReason = JSON.stringify(err);
      }
      await getFabricGateway().logBadAction(randomUUID(), op.blReason);
    }
  }
}

async function verifyWrite(newRecord: NewRecord): Promise<void>  {
  const gateway = getFabricGateway();

  const record = await gateway.readRecord(newRecord.recordId);
  if (record === undefined) {
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

async function verifyRead(access: Access): Promise<void> {
  const accessLog = await getFabricGateway().readAccess(access.accessId);
  if (accessLog === undefined) {
    access.blReason = `Access ${access.accessId} not found`;
    throw new Error(`Access ${access.accessId} not found`);
  }

  console.log(`Access ${access.accessId} validation success`);
}