import {Context, Contract, Info, Returns, Transaction} from 'fabric-contract-api';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';
import { Record } from './record';
import { Action } from './action'

@Info({title: 'Contract', description: 'Smart contract for managing medical records and log operations'})
export class MedskyContract extends Contract {

  @Returns('boolean')
  public async ActionExists(ctx: Context, actionId: string): Promise<boolean> {
    const actionJSON = await ctx.stub.getState(actionId);
    return actionJSON.length > 0;
  }

  @Transaction(false)
  @Returns('string')
  public async ReadAction(ctx: Context, actionId: string): Promise<string> {
    const actionJSON = await ctx.stub.getState(actionId);
    if (actionJSON.length === 0) {
      throw new Error(`The action log ${actionId} does not exist`);
    }

    return actionJSON.toString();
  }

  @Transaction()
  public async LogAction(ctx: Context, recordIds: string[], actionId: string): Promise<void> {
    const exists = await this.ActionExists(ctx, actionId);
    if (exists) {
      throw new Error(`The action ${actionId} already exist`);
    }

    const action: Action =  {
      Requestor: ctx.stub.getCreator().idBytes.toString(),
      RecordIDs: recordIds,
      FunctionName: ctx.stub.getFunctionAndParameters().fcn,
      FunctionParameters: ctx.stub.getFunctionAndParameters().params
    }

    return ctx.stub.putState(actionId, Buffer.from(JSON.stringify(action), 'utf8'));
  }

  @Transaction(false)
  @Returns('boolean')
  public async RecordExists(ctx: Context, id: string): Promise<boolean> {
    const recordJSON = await ctx.stub.getState(id);
    return recordJSON.length > 0;
  }

  @Transaction()
  @Returns('string')
  public async ReadRecordTx(ctx: Context, recordIds: string[] | string, actionId: string): Promise<string> {
    let records = [];
    let recordIdsArray: string[];
    if (typeof recordIds == 'string') {
        recordIdsArray = [recordIds];
    } else {
        recordIdsArray = recordIds;
    }

    for (const recordId of recordIds) {
      const recordJSON = await ctx.stub.getState(recordId); // get the asset from chaincode state
      if (recordJSON.length === 0) {
        throw new Error(`The record ${recordId} does not exist`);
      }
      records.push(recordJSON);
    }

    await this.LogAction(ctx, recordIdsArray, actionId);

    return records.toString();
  }

  @Transaction(false)
  @Returns('string')
  public async ReadRecord(ctx: Context, recordId: string): Promise<string> {
    const recordJSON = await ctx.stub.getState(recordId); // get the asset from chaincode state
    if (recordJSON.length === 0) {
      throw new Error(`The record ${recordId} does not exist`);
    }

    return recordJSON.toString();
  }

  @Transaction()
  public async CreateRecord(ctx: Context, recordIds: string[] | string, hashes: string[] | string, actionId: string): Promise<void> {
    let recordIdsArray: string[];
    let hashesArray: string[];
    if (typeof recordIds == 'string' && typeof hashes == 'string') {
        recordIdsArray = [recordIds];
        hashesArray = [hashes];
    } else if (Array.isArray(recordIds) && Array.isArray(hashes)){
        recordIdsArray = recordIds;
        hashesArray = hashes;
    } else {
        throw new Error(`recordIds and hashes have different types`);
    }

    if (recordIds.length !== hashes.length) {
      throw new Error(`The number of record ids is different from the number of hashes`);
    }

    for (let i = 0; i < recordIdsArray.length; i++) {

      const record: Record = {
        From: ctx.stub.getCreator().idBytes.toString(),
        Hash: hashesArray[i]
      };

      await ctx.stub.putState(recordIds[i], Buffer.from(stringify(sortKeysRecursive(record))));
    }

    await this.LogAction(ctx, recordIdsArray, actionId);
  }

  @Transaction()
  public async DeleteRecord(ctx: Context, recordId: string, actionId: string): Promise<void> {
    const exists = await this.RecordExists(ctx, recordId);
    if (!exists) {
      throw new Error(`The record ${recordId} does not exist`);
    }

    await this.LogAction(ctx, [recordId], actionId);
    return ctx.stub.deleteState(recordId);
  }
}