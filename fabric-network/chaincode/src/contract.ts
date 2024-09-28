import {Context, Contract, Info, Returns, Transaction} from 'fabric-contract-api';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';
import { Record } from './record';
import { Access } from './access'
import {BadAction} from "./badAction";

@Info({title: 'Contract', description: 'Smart contract for managing medical records and log operations'})
export class MedskyContract extends Contract {

  @Returns('boolean')
  public async AccessExists(ctx: Context, accessId: string): Promise<boolean> {
    const accessJSON = await ctx.stub.getState(accessId);
    return accessJSON.length > 0;
  }

  @Transaction(false)
  @Returns('string')
  public async ReadAccesses(ctx: Context, accessIds: string[]): Promise<string[]> {
    const accesses: string[] = [];
    for (const accessId of accessIds) {
      const accessJSON = await ctx.stub.getState(accessId);
      if (accessJSON.length === 0) {
        console.error(`The access log ${accessId} does not exist`);
        accesses.push('');
      }

      accesses.push(accessJSON.toString());
    }

    return accesses;
  }

  @Transaction()
  public async LogAccess(ctx: Context, recordIds: string[], accessId: string): Promise<void> {
    const exists = await this.AccessExists(ctx, accessId);
    if (exists) {
      throw new Error(`The access ${accessId} already exist`);
    }

    const access: Access =  {
      Requestor: ctx.stub.getCreator().idBytes.toString(),
      RecordIDs: recordIds,
    }

    return ctx.stub.putState(accessId, Buffer.from(stringify(sortKeysRecursive(access)), 'utf-8'));
  }

  @Transaction(false)
  @Returns('boolean')
  public async RecordExists(ctx: Context, id: string): Promise<boolean> {
    const recordJSON = await ctx.stub.getState(id);
    return recordJSON.length > 0;
  }

  @Transaction()
  @Returns('string')
  public async ReadRecordsTx(ctx: Context, recordIds: string[], actionId: string): Promise<string> {
    const records = [];

    for (const recordId of recordIds) {
      const recordJSON = await ctx.stub.getState(recordId); // get the asset from chaincode state
      if (recordJSON.length === 0) {
        throw new Error(`The record ${recordId} does not exist`);
      }
      records.push(recordJSON);
    }

    await this.LogAccess(ctx, recordIds, actionId);

    return records.toString();
  }

  @Transaction()
  @Returns('string')
  public async ReadRecordTx(ctx: Context, recordId: string, accessId: string): Promise<string> {
    const recordJSON = await ctx.stub.getState(recordId); // get the asset from chaincode state
    if (recordJSON.length === 0) {
      throw new Error(`The record ${recordId} does not exist`);
    }

    await this.LogAccess(ctx, [recordId], accessId);

    return recordJSON.toString();
  }

  @Transaction(false)
  @Returns('string')
  public async ReadRecords(ctx: Context, recordIds: string[]): Promise<string[]> {
    const records: string[] = [];
    for (const recordId of recordIds) {
      const recordJSON = await ctx.stub.getState(recordId); // get the asset from chaincode state
      if (recordJSON.length === 0) {
        console.error(`The record ${recordId} does not exist`);
        records.push('');
      }

      records.push(recordJSON.toString());
    }

    return records;
  }

  @Transaction()
  public async CreateRecords(ctx: Context, recordIds: string[], hashes: string[]): Promise<void> {
    if (recordIds.length !== hashes.length) {
      throw new Error(`The number of record ids is different from the number of hashes`);
    }

    for (let i = 0; i < recordIds.length; i++) {

      const record: Record = {
        Requestor: ctx.stub.getCreator().idBytes.toString(),
        Hash: hashes[i]
      };

      await ctx.stub.putState(recordIds[i], Buffer.from(stringify(sortKeysRecursive(record)), 'utf-8'));
    }
  }

  @Transaction()
  public async CreateRecord(ctx: Context, recordId: string, hash: string): Promise<void> {

    const record: Record = {
      Requestor: ctx.stub.getCreator().idBytes.toString(),
      Hash: hash
    };

    await ctx.stub.putState(recordId, Buffer.from(stringify(sortKeysRecursive(record)), 'utf-8'));
  }

  @Transaction()
  public async DeleteRecord(ctx: Context, recordId: string, actionId: string): Promise<void> {
    const exists = await this.RecordExists(ctx, recordId);
    if (!exists) {
      throw new Error(`The record ${recordId} does not exist`);
    }

    await this.LogAccess(ctx, [recordId], actionId);
    return ctx.stub.deleteState(recordId);
  }

  @Transaction()
  public async LogBadAction(
    ctx: Context, badActionId: string, requestor: string, reason: string): Promise<void> {

    const badAction: BadAction = {
      Requestor: requestor,
      Reason: reason
    }

    return ctx.stub.putState(badActionId, Buffer.from(stringify(sortKeysRecursive(badAction))));
  }
}