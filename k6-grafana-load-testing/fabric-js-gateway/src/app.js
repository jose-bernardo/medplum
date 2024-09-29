const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'medsky');

const ORG = Math.floor(Math.random() * 5 + 1);
const mspId = envOrDefault('MSP_ID', `Org${ORG}MSP`);

// Path to crypto materials.
const cryptoPath = envOrDefault(
  'CRYPTO_PATH',
  path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'fabric-network',
    'organizations',
    'peerOrganizations',
    `org${ORG}.example.com`
  )
);

// Path to user private key directory.
const keyDirectoryPath = envOrDefault(
  'KEY_DIRECTORY_PATH',
  path.resolve(
    cryptoPath,
    'users',
    `User1@org${ORG}.example.com`,
    'msp',
    'keystore'
  )
);

// Path to user certificate directory.
const certDirectoryPath = envOrDefault(
  'CERT_DIRECTORY_PATH',
  path.resolve(
    cryptoPath,
    'users',
    `User1@org${ORG}.example.com`,
    'msp',
    'signcerts'
  )
);

// Path to peer tls certificate.
const tlsCertPath = envOrDefault(
  'TLS_CERT_PATH',
  path.resolve(cryptoPath, 'peers', `peer0.org${ORG}.example.com`, 'tls', 'ca.crt')
);

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', `peer0.org${ORG}.example.com:8${ORG}01`);

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', `peer0.org${ORG}.example.com`);

async function main() {
  const client = await newGrpcConnection();

  const gateway = connect({
    client,
    identity: await newIdentity(),
    signer: await newSigner(),
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

  const network = gateway.getNetwork(channelName);

  const contract = network.getContract(chaincodeName);

  if (process.argv[2] === 'CreateRecords') {
    const recordIds = JSON.parse(Buffer.from(process.argv[3], 'base64').toString('utf-8'));
    const hashes = JSON.parse(Buffer.from(process.argv[4], 'base64').toString('utf-8'));

    await createRecords(contract, JSON.stringify(recordIds), JSON.stringify(hashes));
  } else if (process.argv[1] === 'ReadRecordsTx') {
    const recordIds = JSON.parse(Buffer.from(process.argv[3], 'base64').toString('utf-8'));
    const accessId = process.argv[4];
    await readRecordsTx(contract, JSON.stringify(recordIds), accessId);
  } else {
    throw new Error('Unknown contract function');
  }
}

main().catch((error) => {
  console.error('******** FAILED to run the application:', error);
  process.exitCode = 1;
});

async function newGrpcConnection() {
  const tlsRootCert = await fs.readFile(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': peerHostAlias,
  });
}

async function newIdentity() {
  const certPath = await getFirstDirFileName(certDirectoryPath);
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}

async function getFirstDirFileName(dirPath) {
  const files = await fs.readdir(dirPath);
  const file = files[0];
  if (!file) {
    throw new Error(`No files in directory: ${dirPath}`);
  }
  return path.join(dirPath, file);
}

async function newSigner() {
  const keyPath = await getFirstDirFileName(keyDirectoryPath);
  const privateKeyPem = await fs.readFile(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

async function createRecords(contract, recordIds, hashes) {
  await contract.submitTransaction(
    'CreateRecords',
    recordIds,
    hashes
  );
}

async function readRecordsTx(contract, recordIds, accessId) {
  await contract.evaluateTransaction(
    'ReadRecordsTx',
    recordIds,
    accessId
  );
}

function envOrDefault(key, defaultValue) {
  return process.env[key] || defaultValue;
}