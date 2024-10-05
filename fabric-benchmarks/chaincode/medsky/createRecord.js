'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const {createReadStream} = require("fs");
const {createHash} = require("node:crypto");
const {pipeline} = require("stream/promises");

async function computeFileHash(filepath) {
  const input = createReadStream(filepath);
  const hash = createHash('sha256');

  await pipeline(input, hash);

  return hash.digest('hex');
}

/**
 * Workload module for the benchmark round.
 */
class CreateRecordWorkload extends WorkloadModuleBase {

  constructor() {
    super();
    this.txIndex = 0;
  }

  /**
   * Assemble TXs for the round.
   * @return {Promise<TxStatus[]>}
   */
  async submitTransaction() {
    this.txIndex++;
    let recordId = this.txIndex.toString();
    let actionId = this.txIndex.toString();

    let args = {
      contractId: 'medsky',
      contractVersion: '1',
      contractFunction: 'CreateRecord',
      contractArguments: [
        'Client' + this.workerIndex + '_RECORD' + recordId,
        '0a800e7a696fae9733efffe908aac21f2d5b072c7de575e8fef0ac7de5dc164a'
      ],
      timeout: 30,
    };

    await this.sutAdapter.sendRequests(args);
  }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
  return new CreateRecordWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;