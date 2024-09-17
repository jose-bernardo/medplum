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

async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  const hash = createHash('sha256');
  const binary = createReadStream(filePath, { highWaterMark: 2 * 1024 * 1024 });
  await stream.pipeline(binary, hash);

  return hash.digest('hex') === expectedHash;
}

const app = express();
const gateway = new FabricGateway(config.fabric);
gateway.connect();

app.get('/', (_req: Request, res: Response) => {
  res.sendStatus(200);
})

app.get('/download/:filename/:version', async (_req: Request, res: Response) => {

  _req.on('aborted', () => {
  });

  res.on('close', () => {
  });

  const filename = _req.params.filename;
  const version = _req.params.version;
  const filepath = resolve(syncDirPath, filename + '.' + version);

  res.download(filepath, err => {
    if (err) {
      res.status(404).send('File not found.');
    }
  });
})

app.post('/upload', async (req: Request, res: Response) => {
  const binarySource: Readable | string = req;

  let uploadAborted = false;
  req.on('aborted', () => {
    uploadAborted = true;
  });

  res.on('close', () => {
  });

  const record = await gateway.readRecord((req.query.key as string).split('/')[0]);
  if (record === undefined) {
    res.status(200).send('Request not recorded on the Fabric network.');
    return;
  }
  const expectedHash = record.Hash;

  const dest = resolve(syncDirPath, (req.query.key as string).replace('/', '.'));
  const writeStream = createWriteStream(dest);
  await stream.pipeline(binarySource, writeStream);

  if (uploadAborted) {
    await rm(dest);
    return;
  }

  const isVerified = await verifyFileHash(dest, expectedHash);
  if (isVerified) {
    res.status(200).send(`File uploaded successfully: ${req.params.key}`);
  } else {
    await rm(dest)
    res.status(400).send('File hash does not match');
  }
})

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
})