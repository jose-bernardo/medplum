import {Context, Contract, Info, Returns, Transaction} from 'fabric-contract-api';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';
import { Record } from './record';
import { Action } from './action'

@Info({title: 'Contract', description: 'Smart contract for managing medical records and log operations'})
export class MedskyContract extends Contract {

  @Transaction(false)
  @Returns('boolean')
  public async ActionExists(ctx: Context, actionId: string): Promise<boolean> {
    const actionJSON = await ctx.stub.getState(actionId);
    return actionJSON.length > 0;
  }

  @Transaction(false)
  @Returns('string')
  public async ReadAction(ctx: Context, actionId: string): Promise<string> {
    const actionJSON = await ctx.stub.getState(actionId); // get the asset from chaincode state
    if (actionJSON.length === 0) {
      throw new Error(`The action log ${actionId} does not exist`);
    }

    return actionJSON.toString();
  }

  @Transaction()
  public async LogAction(ctx: Context, recordId: string, actionId: string): Promise<void> {
    const exists = await this.ActionExists(ctx, actionId);
    if (exists) {
      throw new Error(`The action ${actionId} already exist`);
    }

    const action: Action =  {
      ID: actionId,
      Requestor: ctx.stub.getCreator().idBytes.toString(),
      RecordID: recordId,
      FunctionName: ctx.stub.getFunctionAndParameters().fcn,
      FunctionParameters: ctx.stub.getFunctionAndParameters().params
    }

    return ctx.stub.putState(action.ID, Buffer.from(JSON.stringify(action), 'utf8'));
  }

  @Transaction(false)
  @Returns('boolean')
  public async RecordExists(ctx: Context, id: string): Promise<boolean> {
    const recordJSON = await ctx.stub.getState(id);
    return recordJSON.length > 0;
  }

  @Transaction()
  @Returns('string')
  public async ReadRecordTx(ctx: Context, recordId: string, actionId: string): Promise<string> {
    const recordJSON = await ctx.stub.getState(recordId); // get the asset from chaincode state
    if (recordJSON.length === 0) {
      throw new Error(`The record ${recordId} does not exist`);
    }

    await this.LogAction(ctx, recordId, actionId);

    return recordJSON.toString();
  }

  @Transaction(false)
  @Returns('string')
  public async ReadRecord(ctx: Context, recordId: string): Promise<string> {
    const recordJSON = await ctx.stub.getState(recordId); // get the asset from chaincode state
    if (recordJSON.length === 0) {
      throw new Error(`The record log ${recordId} does not exist`);
    }

    return recordJSON.toString();
  }

  @Transaction()
  public async CreateRecord(ctx: Context, recordId: string, hash: string, actionId: string): Promise<void> {
    const exists = await this.RecordExists(ctx, recordId);
    if (exists) {
      throw new Error(`The record ${recordId} already exist`);
    }

    const record: Record = {
      ID: recordId,
      From: ctx.stub.getCreator().idBytes.toString(),
      Hash: hash
    };

    await this.LogAction(ctx, recordId, actionId);

    return ctx.stub.putState(recordId, Buffer.from(stringify(sortKeysRecursive(record))));
  }

  @Transaction()
  public async UpdateRecord(ctx: Context, recordId: string, hash: string, actionId: string): Promise<void> {
    const exists = await this.RecordExists(ctx, recordId);
    if (!exists) {
      throw new Error(`The record ${recordId} does not exist`);
    }

    const updatedRecord: Record = {
      ID: recordId,
      From: ctx.stub.getCreator().idBytes.toString(),
      Hash: hash
    };

    await this.LogAction(ctx, recordId, actionId);
    return ctx.stub.putState(recordId, Buffer.from(stringify(sortKeysRecursive(updatedRecord))));
  }

  @Transaction()
  public async DeleteRecord(ctx: Context, recordId: string, actionId: string): Promise<void> {
    const exists = await this.RecordExists(ctx, recordId);
    if (!exists) {
      throw new Error(`The record ${recordId} does not exist`);
    }

    await this.LogAction(ctx, recordId, actionId);
    return ctx.stub.deleteState(recordId);
  }
}