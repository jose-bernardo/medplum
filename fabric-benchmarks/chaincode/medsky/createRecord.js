'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { randomUUID } = require('node:crypto');

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
    let actionId = randomUUID().toString();

    let args = {
      contractId: 'medsky',
      contractVersion: '1',
      contractFunction: 'CreateRecord',
      contractArguments: ['Client' + this.workerIndex + '_RECORD' + recordId, 'hashes_are_fun', actionId],
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