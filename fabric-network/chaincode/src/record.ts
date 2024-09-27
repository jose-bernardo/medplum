import {Object, Property} from 'fabric-contract-api';

@Object()
export class Record {
    @Property()
    public docType?: string;

    @Property()
    public Requestor: string = '';

    @Property()
    public Hash: string = '';

    @Property()
    public LastUpdated?: number = Date.now();
}