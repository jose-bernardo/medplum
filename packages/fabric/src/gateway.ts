import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';

const utf8Decoder = new TextDecoder();

export interface FabricOptions {
  channelName: string
  chaincodeName: string
  mspId: string
  keyPath: string
  certPath: string
  tlsCertPath: string
  peerEndpoint: string
  peerHostAlias: string
}

export class FabricGateway {
  private client?: grpc.Client;
  private gateway?: Gateway;
  private contract?: Contract;
  private options: FabricOptions;

  constructor(options: FabricOptions) {
    this.options = options;
    this.displayFabricParameters();
  }

  displayFabricParameters(): void {
    console.log(`channelName:       ${this.options.channelName}`);
    console.log(`chaincodeName:     ${this.options.chaincodeName}`);
    console.log(`mspId:             ${this.options.mspId}`);
    console.log(`keyPath:           ${this.options.keyPath}`);
    console.log(`certPath:          ${this.options.certPath}`);
    console.log(`tlsCertPath:       ${this.options.tlsCertPath}`);
    console.log(`peerEndpoint:      ${this.options.peerEndpoint}`);
    console.log(`peerHostAlias:     ${this.options.peerHostAlias}`);
  }

  private async newSigner(): Promise<Signer> {
    const keyPath = this.options.keyPath;
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
  }

  private async newIdentity(): Promise<Identity> {
    const certPath = this.options.certPath
    const credentials = await fs.readFile(certPath);
    const mspId = this.options.mspId;
    return { mspId, credentials };
  }

  async newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(this.options.tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(this.options.peerEndpoint, tlsCredentials, {
      'grpc.ssl_target_name_override': this.options.peerHostAlias,
    });
  }

  async connect(): Promise<void> {
    this.client = await this.newGrpcConnection();

    this.gateway = connect({
      client: this.client,
      identity: await this.newIdentity(),
      signer: await this.newSigner(),
      // Default timeouts for different gRPC calls
      evaluateOptions: () => {
        return { deadline: Date.now() + 5000 }; // 5 seconds
      },
      endorseOptions: () => {
        return { deadline: Date.now() + 15000 }; // 15 seconds
      },
      submitOptions: () => {
        return { deadline: Date.now() + 5000 }; // 5 seconds
      },
      commitStatusOptions: () => {
        return { deadline: Date.now() + 60000 }; // 1 minute
      },
    });

    const network = this.gateway.getNetwork(this.options.channelName);
    this.contract = network.getContract(this.options.chaincodeName);
  }

  async readEhrNoLog(resourceId: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    try {
      console.log('\n--> Evaluate Transaction: ReadEHRNoLog');
      const resultBytes = await this.contract.evaluateTransaction('ReadEHRNoLog', resourceId);
      const resultJson = utf8Decoder.decode(resultBytes);
      const result = JSON.parse(resultJson);

      console.log('*** Result:', result);

      return result;
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async recordUpdateOnLedger(hash: string, resourceId: string): Promise<JSON> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    try {
      console.log('\n--> Submit Transaction: CreateEHR');

      const resultBytes = await this.contract.submitTransaction(
        'CreateEHR',
        resourceId,
        hash
      );
      const resultJson = utf8Decoder.decode(resultBytes);
      const result = JSON.parse(resultJson);

      console.log('*** Result:', result);
      console.log('*** Transaction committed successfully');

      return result;
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async recordDeleteOnLedger(resourceId: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Submit Transaction: DeleteEHR');

    const resultBytes = await this.contract.submitTransaction('DeleteEHR', resourceId);

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);
    console.log('*** Transaction committed successfully');

    return result;
  }

  async recordReadOnLedger(resourceId: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Submit Transaction: ReadEHR');

    const resultBytes = await this.contract.submitTransaction('ReadEHR', resourceId);

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);
    console.log('*** Transaction committed successfully');

    return result;
  }

  async readActionLogEntry(logEntryId: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    try {
      console.log('\n--> Evaluate Transaction: ReadActionLogEntry');

      const resultBytes = await this.contract.evaluateTransaction('ReadActionLogEntry', logEntryId);

      const resultJson = utf8Decoder.decode(resultBytes);
      const result = JSON.parse(resultJson);
      console.log('*** Result:', result);

      return result;
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async readActionLogEntryByEhrId(ehrId: string): Promise<void> {
    /* empty */
    console.log(ehrId);
  }

  async close(): Promise<void> {
    if (this.client && this.gateway) {
      this.client.close();
      this.gateway.close();
    }
  }
}