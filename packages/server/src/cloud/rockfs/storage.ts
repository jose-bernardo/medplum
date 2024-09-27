import {BinarySource, BinaryStorage, checkFileMetadata} from "../../fhir/storage";
import {Binary} from "@medplum/fhirtypes";
import {Readable} from "node:stream";
import {sep} from "path";
import fetch from "node-fetch";
import {getConfig} from "../../config";
import {createSign} from "crypto";

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
    const response = await fetch(this.url + 'download/' + key);
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

    if (_contentType === undefined) {
      throw new Error('ContentType is required');
    }

    console.log('Uploading file...');

    const options =  {
      method: 'POST',
      headers: { 'Content-Type': _contentType },
      body: input
    };

    const response = await fetch(this.url + `upload?key=${key}`, options);

    if (response.status === 400) {
      throw new Error('Failed to upload file: ' + response.body.read());
    }
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