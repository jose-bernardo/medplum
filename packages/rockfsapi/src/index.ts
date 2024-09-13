import express, { Request, Response } from 'express';
import { FabricGateway } from '@medplum/fabric-gateway'
import { readFileSync } from 'fs';
import { writeFile  } from 'fs/promises'
import { resolve } from 'path';
import stream from 'stream/promises';
import { createHash } from 'crypto';
import { RockFSConfig } from './config';
import {Readable} from "node:stream";

const config: RockFSConfig =  JSON.parse(readFileSync(resolve(__dirname, '../', './config.json'), { encoding: 'utf8' }));
const syncDirPath = resolve(__dirname, '../', config.syncDir);

async function verifyFileHash(binary: Readable | string, expectedHash: string): Promise<boolean> {
  const hash = createHash('sha256');

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

  const record = await gateway.readRecord((req.query.key as string).split('/')[0]);
  if (record === undefined) {
    res.status(200).send('Request not recorded on the Fabric network.');
    return;
  }
  const expectedHash = record.Hash;

  const isVerified = await verifyFileHash(binarySource, expectedHash);

  if (isVerified) {
    res.status(200).send(`File uploaded successfully: ${req.params.key} (${req.file.size})`);
    await writeFile(resolve(syncDirPath, (req.body.id as string).replace('/', '.')), binarySource);
  } else {
    res.status(400).send('File hash does not match');
  }
})

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
})