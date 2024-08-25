import * as grpc from '@grpc/grpc-js';
export interface FabricOptions {
    channelName: string;
    chaincodeName: string;
    mspId: string;
    keyPath: string;
    certPath: string;
    tlsCertPath: string;
    peerEndpoint: string;
    peerHostAlias: string;
}
export declare class FabricGateway {
    private client?;
    private gateway?;
    private contract?;
    private options;
    constructor(options: FabricOptions);
    displayFabricParameters(): void;
    private newSigner;
    private newIdentity;
    newGrpcConnection(): Promise<grpc.Client>;
    connect(): Promise<void>;
    readEhrNoLog(resourceId: string): Promise<any>;
    recordUpdateOnLedger(hash: string, resourceId: string): Promise<JSON>;
    recordDeleteOnLedger(resourceId: string): Promise<any>;
    recordReadOnLedger(resourceId: string): Promise<any>;
    readActionLogEntry(logEntryId: string): Promise<any>;
    readActionLogEntryByEhrId(ehrId: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=gateway.d.ts.map