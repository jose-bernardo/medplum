import {BinarySource, BinaryStorage, checkFileMetadata} from "../../fhir/storage";
import {Binary} from "@medplum/fhirtypes";
import {Readable} from "node:stream";
import {sep} from "path";
import fetch from "node-fetch";
import FormData from 'form-data';
import {getConfig} from "../../config";
import {createSign} from "crypto";
import {createReadStream} from "fs";
import fs from 'fs/promises';

export class RockFSStorage implements BinaryStorage {
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  copyBinary(sourceBinary: Binary, destinationBinary: Binary): Promise<void> {
    // not implemented
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    // not implemented
    return Promise.resolve();
  }

  async readBinary(binary: Binary): Promise<Readable> {
    const key = this.getKey(binary);
    console.log(key);
    const response = await fetch(this.url + 'download?filename=' + key);
    console.log(response);
    return new Readable().wrap(response.body);
}

  writeBinary(
    binary: Binary,
    filename: string | undefined,
    contentType: string | undefined,
    stream: BinarySource
  ): Promise<void> {
    checkFileMetadata(filename, contentType);
    return this.writeFile(this.getKey(binary), contentType, stream);
  }

  async writeFile(key: string, _contentType: string | undefined, input: BinarySource): Promise<void> {

    await fs.writeFile('banana.txt', input);

    const form = new FormData();

    form.append('binary', createReadStream('banana.txt'));
    form.append('id', key);

    const options =  {
      method: 'POST',
      headers: form.getHeaders(),
      body: form
    };

    const response = await fetch(this.url + 'upload', options);

    console.log(response);
  }

  private getKey(binary: Binary): string {
    return binary.id + sep + binary.meta?.versionId;
  }

  getPresignedUrl(binary: Binary): string {
    const config = getConfig();
    const storageBaseUrl = config.storageBaseUrl;
    const result = new URL(`${storageBaseUrl}${binary.id}/${binary.meta?.versionId}`);

    const dateLessThan = new Date();
    dateLessThan.setHours(dateLessThan.getHours() + 1);
    result.searchParams.set('Expires', dateLessThan.getTime().toString());

    const privateKey = { key: config.signingKey, passphrase: config.signingKeyPassphrase };
    const signature = createSign('sha256').update(result.toString()).sign(privateKey, 'base64');
    result.searchParams.set('Signature', signature);

    return result.toString();
  }
}