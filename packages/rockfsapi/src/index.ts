import express, { Request, Response } from 'express';
import { FabricGateway } from '@medplum/fabric-gateway'
import { createReadStream, readFileSync } from 'fs';
import { rm, rename  } from 'fs/promises'
import { resolve } from 'path';
import stream from 'stream/promises';
import { createHash } from 'crypto';
import { RockFSConfig } from './config';
import {writeFile} from "node:fs/promises";

const config: RockFSConfig =  JSON.parse(readFileSync(resolve(__dirname, '../', './config.json'), { encoding: 'utf8' }));
const syncDirPath = resolve(__dirname, '../', config.syncDir);

async function computeFileHash(filepath: string, expectedHash: string): Promise<boolean> {
  const input = createReadStream(filepath);
  const hash = createHash('sha256');

  await stream.pipeline(input, hash);

  return hash.digest('hex') === expectedHash;
}

const app = express();
const gateway = new FabricGateway(config.fabric);
gateway.connect();

app.get('/', (_req: Request, res: Response) => {
  res.sendStatus(200);
})

app.get('/download/:filename', async (_req: Request, res: Response) => {
  const filename = _req.params.filename;
  const filepath = resolve(config.syncDir, filename);

  res.download(filepath, err => {
    if (err) {
      res.status(404).send('File not found.');
    }
  });
})

app.post('/upload', async (req: Request, res: Response) => {
  if (!req.body.binary) {
    res.status(400).send('No file uploaded.');
    return;
  }

  const data = createReadStream(req.body.binary);
  await writeFile(resolve(__dirname, '..', 'tmp', req.body.id), data);

  const record = await gateway.readRecord(req.body.id);
  const expectedHash = record.Hash;

  const isVerified = await computeFileHash(req.file.path, expectedHash);

  if (isVerified) {
    res.status(200).send(`File uploaded successfully: ${req.file.fieldname} (${req.file.size})`);
    await rename(req.file.path, resolve(syncDirPath, req.file.filename));
  } else {
    res.status(401).send();
    await rm(req.file.path);
  }
})

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
})