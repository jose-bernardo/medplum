import {Object, Property} from 'fabric-contract-api';

@Object()
export class Access {
  @Property()
  public docType?: string;

  @Property()
  public Requestor: string = '';

  @Property()
  public RecordIDs: string[] = [];

  @Property()
  public Timestamp?: number = Date.now();
}