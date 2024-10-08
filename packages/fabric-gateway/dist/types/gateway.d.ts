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
    private signer?;
    private gateway?;
    private contract?;
    private options;
    constructor(options: FabricOptions);
    displayFabricParameters(): string;
    private newSigner;
    private newIdentity;
    newGrpcConnection(): Promise<grpc.Client>;
    connect(): Promise<void>;
    readAccesses(accessIds: string[]): Promise<any>;
    readRecords(ids: string[]): Promise<any>;
    logBadAction(id: string, requestor: string, recordId: string, actionId: string, reason: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=gateway.d.ts.map