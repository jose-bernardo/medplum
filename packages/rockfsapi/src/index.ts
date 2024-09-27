import express, { Request, Response, NextFunction } from 'express';
import { createWriteStream, readFileSync } from 'fs';
import { resolve } from 'path';
import stream from 'stream/promises';
import { RockFSConfig } from './config';
import { Readable } from "stream";
import { rm } from 'fs/promises'

const config: RockFSConfig =  JSON.parse(readFileSync(resolve(__dirname, '../', './config.json'), { encoding: 'utf8' }));
const syncDirPath = resolve(__dirname, '../', config.syncDir);

const app = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  req.on('aborted', () => {
    console.log('Request was aborted by the client.');
  });
  next();
});

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

  if (uploadAborted) {
    await rm(dest);
  }

  res.status(200).send('Uploaded successfully');
})

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
})