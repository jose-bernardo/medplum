import {Object, Property} from 'fabric-contract-api';

@Object()
export class Record {
    @Property()
    public docType?: string;

    @Property()
    public From: string = '';

    @Property()
    public Hash: string = '';
}