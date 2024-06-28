import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

import { Resource } from '@medplum/fhirtypes';
import * as console from 'node:console';

const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'ehrcc');
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
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

async function main(): Promise<void> {

  await displayInputParameters();

  // The gRPC client connection should be shared by all Gateway connections to this endpoint.
  const client = await newGrpcConnection();

  const gateway = connect({
    client,
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

  try {
    // Get a network instance representing the channel where the smart contract is deployed.
    const network = gateway.getNetwork(channelName);

    // Get the smart contract from the network.
    const contract = network.getContract(chaincodeName);

    const patientResource: Resource = await loadResource('fhir-samples/patient.json');
    await createResource(contract, patientResource);
  } finally {
    gateway.close();
    client.close();
  }
}

main().catch(error => {
  console.error('******** FAILED to run the application:', error);
  process.exitCode = 1;
});

async function newGrpcConnection(): Promise<grpc.Client> {
  const tlsRootCert = await fs.readFile(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': peerHostAlias,
  });
}

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

async function sha256(data: string): Promise<string> {
  const sha256 = crypto.createHash('sha256');
  sha256.update(data);
  return sha256.digest('hex');
}

async function loadResource(path: string): Promise<Resource> {
  const data= await fs.readFile(path);
  return JSON.parse(data.toString('utf8'));
}

async function createResource(contract: Contract, resource: Resource): Promise<void> {
  // retrieve id from backend server
  const id = 'dasduasdas';

  try {
      const hash = await sha256(JSON.stringify(resource));
      const buffer = (await newIdentity()).credentials;
      const cert = buffer.toString();
      await createResourceHF(contract, id, cert, cert, hash);
      const response = await fetch('http://10.15.0.17:8103/fhir/R4/confirm', {
        method: 'POST',
        body: JSON.stringify({id: id}),
        headers: {'Content-Type': 'application/json'},
      });
      console.log(response);
      console.log('Successfully created resource');
      return Promise.resolve();
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }
}

/*
async function readResource(contract: Contract, resourceType: ResourceType, resourceId: string): Promise<void> {
  let ehrHeader: any;

  try {
    ehrHeader = await readResourceByID(contract, resourceId);
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }

  let resource: any;

  resource = await medplum.readResource(resourceType, resourceId);
  if (!resource) {
    try {
      resource = await fs.readFile(path.resolve(mountDirectoryPath, ehrHeader.id + '.json'));
    } catch (err) {
      console.log(err);
    }
  }

  const hash = await sha256(JSON.stringify(resource))
  const isVerified = hash === ehrHeader.hash;
  console.log(isVerified);
  console.log(resource);
}

async function deleteResource(contract: Contract, resourceType: ResourceType, resourceId: string): Promise<void> {
  try {
    await deleteResourceHF(contract, resourceId);
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }

  try {
    await fs.unlink(path.resolve(mountDirectoryPath, resourceId + '.json'))
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }

  return await medplum.deleteResource(resourceType, resourceId)
}

 */

/**
 * Create EHR transaction
 */
async function createResourceHF(contract: Contract, id: string, to: string, from: string, hash: string): Promise<void> {
  console.log('\n--> Submit Transaction: CreateEHR');

  await contract.submitTransaction(
    'CreateEHR',
    id,
    hash
  );

  console.log('*** Transaction committed successfully');
}

/**
 * Mark an EHR as deleted
 */
/*
async function deleteResourceHF(contract: Contract, id: string): Promise<void> {
  console.log('\n--> Submit Transaction: DeleteEHR');

  await contract.submitTransaction('DeleteEHR', id);

  console.log('*** Transaction commited successfully');
}

async function readResourceByID(contract: Contract, id: string): Promise<JSON> {
  console.log('\n--> Submit Transaction: ReadEHRByID, function returns EHR attributes');

  const resultBytes = await contract.submitTransaction('ReadEHR', id);

  const resultJson = utf8Decoder.decode(resultBytes);
  const result = JSON.parse(resultJson);
  console.log('*** Result:', result);
  console.log('*** Transaction committed successfully');

  return result;
}

 */

/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 */
function envOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
async function displayInputParameters(): Promise<void> {
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