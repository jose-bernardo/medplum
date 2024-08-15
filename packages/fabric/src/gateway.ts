import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';

// TODO change this so its dynamic
const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'basic');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

// Path to security materials.
const cryptoPath = envOrDefault('CRYPTO_PATH', path.resolve(__dirname, '..', '..', '..', 'organizations', 'peerOrganizations', 'org1.example.com'));

// Path to provider private key directory.
const keyDirectoryPath = envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore'));

// Path to provider certificate directory.
const certDirectoryPath = envOrDefault('CERT_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts'));

// Path to peer tls certificate.
const tlsCertPath = envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt'));

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', '10.100.0.12:7051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const utf8Decoder = new TextDecoder();

async function newIdentity(): Promise<Identity> {
  const certPath = await getFirstDirFileName(certDirectoryPath);
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}

async function getFirstDirFileName(dirPath: string): Promise<string> {
  const files = await fs.readdir(dirPath);
  return path.join(dirPath, files[0]);
}

async function newSigner(): Promise<Signer> {
  const keyPath = await getFirstDirFileName(keyDirectoryPath);
  const privateKeyPem = await fs.readFile(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

export class FabricGateway {
  private client?: grpc.Client;
  private gateway?: Gateway;
  private contract?: Contract;

  async newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
      'grpc.ssl_target_name_override': peerHostAlias,
    });
  }

  async connect(): Promise<void> {
    this.client = await this.newGrpcConnection();

    this.gateway = connect({
      client: this.client,
      identity: await newIdentity(),
      signer: await newSigner(),
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

    const network = this.gateway.getNetwork(channelName);
    this.contract = network.getContract(chaincodeName);
  }

  async verifyHash(resource: string, resourceId: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    try {
      console.log('\n--> Submit Transaction: ReadEHRNoLog');

      const resultBytes = await this.contract.submitTransaction('ReadEHRNoLog', resourceId);
      const resultJson = utf8Decoder.decode(resultBytes);
      const result = JSON.parse(resultJson);

      console.log('*** Result:', result);
      console.log('*** Transaction committed successfully');

      const sha256 = (resource: string): string => {
        return createHash('sha256')
          .update(resource)
          .digest('hex');
      }

      return result.hash === sha256(resource);

    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async recordUpdateOnLedger(resourceId: string): Promise<string> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    try {
      const hash = 'samealways'; //await sha256(JSON.stringify(resource));

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

      return JSON.stringify(result);
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async recordDeleteOnLedger(resourceId: string): Promise<void> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Submit Transaction: DeleteEHR');

    await this.contract.submitTransaction('DeleteEHR', resourceId);

    console.log('*** Transaction commited successfully');
  }

  async recordReadOnLedger(resourceId: string): Promise<JSON> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Submit Transaction: ReadEHRByID, function returns EHR attributes');

    const resultBytes = await this.contract.submitTransaction('ReadEntry', resourceId);

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);
    console.log('*** Transaction committed successfully');

    return result;
  }

  async readActionLogEntry(logEntryId: string): Promise<JSON> {
    if (!this.contract) {
      throw new Error('contract not defined');
    }

    console.log('\n--> Submit Transaction: ReadActionLogEntry');

    const resultBytes = await this.contract.submitTransaction('ReadActionLogEntry', logEntryId);

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);
    console.log('*** Transaction committed successfully');

    return result;
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

/*
async function sha256(data: string): Promise<string> {
  const sha256 = crypto.createHash('sha256');
  sha256.update(data);
  return sha256.digest('hex');
}
*/

/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 * @param key - env variable key
 * @param defaultValue - default value for env variable
 *
 * @returns value - value
 */
function envOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
export async function displayFabricParameters(): Promise<void> {
  console.log(`channelName:       ${channelName}`);
  console.log(`chaincodeName:     ${chaincodeName}`);
  console.log(`mspId:             ${mspId}`);
  console.log(`cryptoPath:        ${cryptoPath}`);
  console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
  console.log(`certDirectoryPath: ${certDirectoryPath}`);
  console.log(`tlsCertPath:       ${tlsCertPath}`);
  console.log(`peerEndpoint:      ${peerEndpoint}`);
  console.log(`peerHostAlias:     ${peerHostAlias}`);
}