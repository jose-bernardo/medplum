import {Object, Property} from 'fabric-contract-api';

@Object()
export class BadAction {
  @Property()
  public docType?: string;

  @Property()
  public Requestor: string = '';

  @Property()
  public Reason: string = '';
}