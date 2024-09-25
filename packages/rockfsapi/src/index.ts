import express, { Request, Response } from 'express';
import { FabricGateway } from '@medplum/fabric-gateway'
import { createWriteStream, createReadStream, readFileSync } from 'fs';
import { resolve } from 'path';
import stream from 'stream/promises';
import { createHash } from 'crypto';
import { RockFSConfig } from './config';
import {Readable} from "node:stream";
import { rm } from 'fs/promises'

const config: RockFSConfig =  JSON.parse(readFileSync(resolve(__dirname, '../', './config.json'), { encoding: 'utf8' }));
const syncDirPath = resolve(__dirname, '../', config.syncDir);
const newRecords: NewRecord[] = [];
const freshNewRecords: NewRecord[] = [];
const wrongNewRecords: NewRecord[] = [];

interface NewRecord {
  recordId: string
  filepath: string
  hash: string
}

async function computeFileHash(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const binary = createReadStream(filePath, { highWaterMark: 2 * 1024 * 1024 });
  await stream.pipeline(binary, hash);

  return hash.digest('hex');
}

async function verifyLedger(): Promise<void> {

  const len = newRecords.length;

  const freshLen = freshNewRecords.length;
  for (let i = 0; i < freshLen; i++) {
    newRecords.push(freshNewRecords.splice(0, 1)[0]);
  }

  let i = 0;
  while (i < len) {
    const newRecord = newRecords.shift();
    const record = await gateway.readRecord(newRecord.recordId);
    if (record === undefined) {
      wrongNewRecords.push(newRecord);
      await rm(newRecord.filepath);
      console.error('Record not validated');
      return;
    }

    const expectedHash = record.Hash;
    if (expectedHash !== newRecord.hash) {
      await rm(newRecord.filepath);
      wrongNewRecords.push(newRecord);
      console.error('Digest does not match, file deleted');
    }

    console.log(`Record ${newRecord.recordId} validation success`);
    i++;
  }
}

const app = express();
const gateway = new FabricGateway(config.fabric);
gateway.connect();

setInterval(verifyLedger, 60000);

app.get('/', (_req: Request, res: Response) => {
  res.sendStatus(200);
})

app.get('/download/:filename/:version', async (_req: Request, res: Response) => {

  _req.on('aborted', () => {
  });

  const filename = _req.params.filename;
  const version = _req.params.version;
  const filepath = resolve(syncDirPath, filename + '.' + version);

  res.download(filepath, err => {
    if (err) {
      console.error(err);
    }
  });
})

app.post('/upload', async (req: Request, res: Response) => {
  const binarySource: Readable | string = req;

  let uploadAborted = false;
  req.on('aborted', () => {
    uploadAborted = true;
  });

  const dest = resolve(syncDirPath, (req.query.key as string).replace('/', '.'));
  const writeStream = createWriteStream(dest);
  await stream.pipeline(binarySource, writeStream);

  const hash = await computeFileHash(dest);
  newRecords.push({recordId: (req.query.key as string).split('/')[0], filepath: dest, hash: hash});

  if (uploadAborted) {
    await rm(dest);
  }

  res.status(200).send('Uploaded successfully');
})

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
})