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
  private signer?: Signer;
  private gateway?: Gateway;
  private contract?: Contract;
  private options: FabricOptions;

  constructor(options: FabricOptions) {
    this.options = options;
  }

  displayFabricParameters(): string {
    return `channelName:       ${this.options.channelName}\n` +
    `chaincodeName:     ${this.options.chaincodeName}\n` +
    `mspId:             ${this.options.mspId}\n` +
    `keyPath:           ${this.options.keyPath}\n` +
    `certPath:          ${this.options.certPath}\n` +
    `tlsCertPath:       ${this.options.tlsCertPath}\n` +
    `peerEndpoint:      ${this.options.peerEndpoint}\n` +
    `peerHostAlias:     ${this.options.peerHostAlias}`;
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
    this.signer = await this.newSigner();

    this.gateway = connect({
      // @ts-expect-error: its very good as it is
      client: this.client,
      identity: await this.newIdentity(),
      signer: this.signer,
      // Default timeouts for different gRPC calls
      evaluateOptions: () => {
        return { deadline: Date.now() + 10000 }; // 5 seconds
      },
      endorseOptions: () => {
        return { deadline: Date.now() + 15000 }; // 15 seconds
      },
      submitOptions: () => {
        return { deadline: Date.now() + 10000 }; // 5 seconds
      },
      commitStatusOptions: () => {
        return { deadline: Date.now() + 60000 }; // 1 minute
      },
    });

    const network = this.gateway.getNetwork(this.options.channelName);
    this.contract = network.getContract(this.options.chaincodeName);
  }

  async readAction(actionId: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Evaluate Transaction: ReadAction');
    const resultBytes = await this.contract.evaluateTransaction('ReadAction', actionId);
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);

    return result;
  }

  async readRecord(id: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    try {
      console.log('\n--> Evaluate Transaction: ReadRecord');
      const resultBytes = await this.contract.evaluateTransaction('ReadRecord', id);
      const resultJson = utf8Decoder.decode(resultBytes);
      const result = JSON.parse(resultJson);
      console.log('*** Result:', result);

      return result;
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }

  /*
  async readRecordTx(resourceId: string, actionId: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Submit Transaction: ReadRecordTx');
    const resultBytes = await this.contract.submitTransaction('ReadRecordTx', resourceId, actionId);
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);

    return result;
  }

  async createRecord(resourceId: string, hash: string, actionId: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Submit Transaction: CreateRecord');
    const resultBytes = await this.contract.submitTransaction('CreateRecord', resourceId, hash, actionId);
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);

    return result;
    //return this.contract.newProposal('CreateEHR', { arguments: [resourceId, hash] })
  }

  async deleteRecord(resourceId: string, actionId: string): Promise<any> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Submit Transaction: DeleteRecord');
    const resultBytes = await this.contract.submitTransaction('CreateRecord', resourceId, actionId);
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);

    return result;
  }
  */

  async close(): Promise<void> {
    if (this.client && this.gateway) {
      this.client.close();
      this.gateway.close();
    }
  }

  /*
  async submitTransaction(unsignedProposal: Proposal): Promise<Status> {
    if (this.signer === undefined) {
      throw Error('signer not defined');
    }

    if (this.gateway === undefined) {
      throw Error('gateway not defined');
    }

    const proposalBytes = unsignedProposal.getBytes();
    const proposalDigest = unsignedProposal.getDigest();
    const proposalSignature = await this.signer(proposalDigest);

    const signedProposal = this.gateway.newSignedProposal(proposalBytes, proposalSignature);

    // Done by server
    const unsignedTransaction = await signedProposal.endorse();
    const transactionBytes = unsignedTransaction.getBytes();
    const transactionDigest = unsignedTransaction.getDigest();
    const transactionSignature = await this.signer(transactionDigest)
    const signedTransaction = this.gateway.newSignedTransaction(transactionBytes, transactionSignature);

    // Done by server
    const unsignedCommit = await signedTransaction.submit();
    const commitBytes = unsignedCommit.getBytes();
    const commitDigest = unsignedCommit.getDigest();
    const commitSignature = await this.signer(commitDigest)
    const signedCommit = this.gateway.newSignedCommit(commitBytes, commitSignature);

    const result = signedTransaction.getResult();
    console.log('*** Result:', result);

    // Done by server
    const status = await signedCommit.getStatus();
    console.log('[Status]:', status);

    return status;
  }
  */
}