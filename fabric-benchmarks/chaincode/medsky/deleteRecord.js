'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { randomUUID } = require('node:crypto');

/**
 * Workload module for the benchmark round.
 */
class DeleteRecordWorkload extends WorkloadModuleBase {

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
    let actionId = 'DELETE_ACTION' + this.txIndex.toString();

    let args = {
      contractId: 'medsky',
      contractVersion: '1',
      contractFunction: 'DeleteRecord',
      contractArguments: [
        'Client' + this.workerIndex + '_RECORD' + recordId,
        'Client' + this.workerIndex + '_ACTION' + actionId
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
  return new DeleteRecordWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;