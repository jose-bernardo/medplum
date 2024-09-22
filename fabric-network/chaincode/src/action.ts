import {Object, Property} from 'fabric-contract-api';

@Object()
export class Action {
  @Property()
  public docType?: string;

  @Property()
  public Requestor: string = '';

  @Property()
  public RecordIDs: string[] = [];

  @Property()
  public Timestamp?: number = Date.now();

  @Property()
  public FunctionName: string = '';

  @Property()
  public FunctionParameters: string[] = [];
}