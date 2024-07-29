import * as grpc from '@grpc/grpc-js';

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
export declare function displayFabricParameters(): Promise<void>;

export declare class FabricGateway {
    private client?;
    private gateway?;
    private contract?;
    newGrpcConnection(): Promise<grpc.Client>;
    startGateway(): Promise<void>;
    getContract(chaincodeName: string, channelName: string): Promise<void>;
    recordUpdateOnLedger(resourceId: string): Promise<string>;
    close(): Promise<void>;
}

export { }
