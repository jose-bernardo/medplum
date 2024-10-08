import {ContentType, allOk, badRequest, created, isResource} from '@medplum/core';
import { Binary, OperationOutcome } from '@medplum/fhirtypes';
import { Request, Response, Router } from 'express';
import internal from 'stream';
import zlib from 'zlib';
import { asyncWrap } from '../async';
import { getAuthenticatedContext, getLogger } from '../context';
import { authenticateRequest } from '../oauth/middleware';
import { sendOutcome } from './outcomes';
import { sendResponse } from './response';
import { BinarySource, getBinaryStorage } from './storage';
import {appendNewAccess, appendNewRecord} from "../fabricgateway";
import {createHash} from "crypto";
import {PassThrough, Readable} from "node:stream";

export const binaryRouter = Router().use(authenticateRequest);

// Create a binary
binaryRouter.post('/', asyncWrap(handleBinaryWriteRequest));

// Update a binary
binaryRouter.put('/:id', asyncWrap(handleBinaryWriteRequest));

// Get binary content
binaryRouter.get(
  '/:recordId',
  asyncWrap(async (req: Request, res: Response) => {
    const ctx = getAuthenticatedContext();
    const { recordId } = req.params;

    const accessId = req.query.accessId as string;
    if (accessId === undefined) {
      sendOutcome(res, badRequest('Access ID not provided.'));
      return;
    }

    appendNewAccess({requestor: JSON.stringify(ctx.profile), resourceType: 'Binary', recordId: recordId, accessId: accessId});

    const binary = await ctx.repo.readResource<Binary>('Binary', recordId);
    await sendResponse(req, res, allOk, binary);
  })
);

async function handleBinaryWriteRequest(req: Request, res: Response): Promise<void> {
  const ctx = getAuthenticatedContext();

  const create = req.method === 'POST';

  const recordId = req.query.recordId as string;
  if (recordId === undefined) {
    sendOutcome(res, badRequest('RecordID not provided.'));
    return;
  }

  const contentType = req.get('Content-Type') as string;

  const stream = getContentStream(req);
  if (!stream) {
    sendOutcome(res, badRequest('Unsupported content encoding'));
    return;
  }

  let binary: Binary | undefined = undefined;
  let binarySource: BinarySource = stream;

  // From the spec: https://hl7.org/fhir/R4/binary.html#rest
  //
  // """
  //   When binary data is written to the server (create/update - POST or PUT),
  //   the data is accepted as is and treated as the content of a Binary,
  //   including when the content type is "application/fhir+xml" or "application/fhir+json",
  //   except for the special case where the content is actually a Binary resource.
  // """
  let binaryContentSpecialCase = false;

  if (contentType === ContentType.FHIR_JSON) {
    const str = await readStreamToString(stream);
    try {
      // The binary handler does *not* use Express body-parser in order to support raw binary data.
      // Therefore, we need to manually parse the body stream as JSON.
      const body = JSON.parse(str);
      if (isResource(body) && body.resourceType === 'Binary' && body.id === recordId) {
        // Special case where the content is actually a Binary resource.
        binary = body as Binary;
        binaryContentSpecialCase = true;
      } else {
        // We have already consumed the stream, so we need to create a new one.
        // Instead, use the original string as the source.
        binarySource = str;
      }
    } catch (err) {
      // If the JSON is invalid, then it is not eligible for the special case.
      getLogger().debug('Invalid JSON', { error: err });
      binarySource = str;
    }
  }

  if (!binary) {
    const securityContext = req.get('X-Security-Context');
    binary = {
      resourceType: 'Binary',
      id: recordId,
      contentType,
      securityContext: securityContext ? { reference: securityContext } : undefined,
    };
  }

  let outcome: OperationOutcome;

  if (create) {
    binary = await ctx.repo.createResource<Binary>(binary);
    outcome = created;
  } else {
    binary = await ctx.repo.updateResource<Binary>(binary);
    outcome = allOk;
  }

  const stream1 = new PassThrough();
  const stream2 = new PassThrough();

  const hash = createHash('sha256');

  (binarySource as Readable).pipe(stream1);
  (binarySource as Readable).pipe(stream2);

  stream1.pipe(hash).on('finish', () => {
    const hashh = hash.digest('hex');
    appendNewRecord({requestor: JSON.stringify(ctx.profile), resourceType: 'Binary', recordId: recordId, hash: hashh})
  });

  if (!binaryContentSpecialCase) {
    const filename = undefined;
    await getBinaryStorage().writeBinary(binary, filename, contentType, stream2);
  }

  await sendResponse(req, res, outcome, {
    ...binary,
    url: getBinaryStorage().getPresignedUrl(binary),
  });
}

/**
 * Get the content stream of the request.
 *
 * Based on body-parser implementation:
 * https://github.com/expressjs/body-parser/blob/master/lib/read.js
 *
 * Unfortunately body-parser will always write the content to a temporary file on local disk.
 * That is not acceptable for multi gigabyte files, which could easily fill up the disk.
 * @param req - The HTTP request.
 * @returns The content stream.
 */
function getContentStream(req: Request): internal.Readable | undefined {
  const encoding = req.headers['content-encoding'];
  if (!encoding) {
    return req;
  }

  if (encoding.toLowerCase() === 'deflate') {
    const stream = zlib.createInflate();
    req.pipe(stream);
    return stream;
  }

  if (encoding.toLowerCase() === 'gzip') {
    const stream = zlib.createGunzip();
    req.pipe(stream);
    return stream;
  }

  return undefined;
}

async function readStreamToString(stream: internal.Readable): Promise<string> {
  let data = '';
  // Set the encoding to UTF-8 to ensure each chunk is a string
  stream.setEncoding('utf8');
  for await (const chunk of stream) {
    data += chunk;
  }
  return data;
}
