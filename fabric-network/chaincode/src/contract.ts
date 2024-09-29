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
  public async ReadAccesses(ctx: Context, accessIdsJson: string): Promise<string> {
    const accessIds = JSON.parse(accessIdsJson);
    const accesses: string[] = [];
    for (const accessId of accessIds) {
      const accessJSON = await ctx.stub.getState(accessId);
      if (accessJSON.length === 0) {
        console.error(`The access log ${accessId} does not exist`);
        accesses.push('');
      } else {
        accesses.push(accessJSON.toString());
      }
    }

    return JSON.stringify(accesses);
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
  public async ReadRecordsTx(ctx: Context, recordIdsJson: string, accessId: string): Promise<string> {
    const records = [];
    const recordIds = JSON.parse(recordIdsJson);
    for (const recordId of recordIds) {
      const recordJSON = await ctx.stub.getState(recordId);
      if (recordJSON.length === 0) {
        records.push('');
        console.error(`The record ${recordId} does not exist`);
      } else {
        records.push(JSON.parse(recordJSON.toString()));
      }
    }

    await this.LogAccess(ctx, recordIds, accessId);

    return JSON.stringify(records);
  }

  @Transaction()
  @Returns('string')
  public async ReadRecordTx(ctx: Context, recordId: string, accessId: string): Promise<string> {
    const recordJSON = await ctx.stub.getState(recordId);
    if (recordJSON.length === 0) {
      throw new Error(`The record ${recordId} does not exist`);
    }

    await this.LogAccess(ctx, [recordId], accessId);

    return recordJSON.toString();
  }

  @Transaction(false)
  public async ReadRecords(ctx: Context, recordIdsJson: string): Promise<string> {
    const recordIds = JSON.parse(recordIdsJson);
    const records: string[] = [];
    for (const recordId of recordIds) {
      const recordJSON = await ctx.stub.getState(recordId);
      if (recordJSON.length === 0) {
        console.error(`The record ${recordId} does not exist`);
        records.push('');
      }

      records.push(recordJSON.toString());
    }

    return JSON.stringify(records);
  }

  @Transaction()
  public async CreateRecords(ctx: Context, recordIdsJson: string, hashesJson: string): Promise<void> {
    const recordIds = JSON.parse(recordIdsJson);
    const hashes = JSON.parse(hashesJson);
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