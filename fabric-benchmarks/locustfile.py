import uuid
import hashlib
import os
from locust import HttpUser, task, between
from urllib3 import PoolManager

class MedSkyUser(HttpUser):
    #pool_manager = PoolManager(maxsize=10, block=True)
    host = "http://localhost:5555"
    wait_time = between(1, 5)

    def on_start(self):
        self.clientId = 0
        self.clientN = 5
        self.txId = 0
        self.limitTxId = 500
        token = ''
        self.client.headers.update({'Authorization': f'Bearer {token}'})

    @task
    def create_record(self):
        recordId = 'CLIENT' + self.clientId + '_RECORD' + str(self.txId)
        actionId = 'CLIENT' + self.clientId + '_ACTION' + str(self.txId)
        data = open('dicom-sample.zip').read()
        with open('dicom-sample.zip', 'rb') as f:
            files = {'file': (os.path.basename(self.file_path), f)}
            response = self.client.post(f"/fhir/R4/Binary?recordId={recordId}&actionId={actionId}", files=files, stream=True);
        print(response)
        self.txId += 1

        if self.txId > self.limitTxId:
            self.clientId += 1

        if self.clientId < self.clientN:
            self.environment.runner.quit()

    """
    @task
    def read_record(self):
        recordId = 'RECORD_' + str(self.txId)
        actionId = 'ACTION_' + str(self.txId)
        submit_transaction(self, ['ReadRecordTx', recordId, actionId])
        response = self.client.get(f"/fhir/R4/Binary/{recordId}?actionId={actionId}")
        print(response)
    """