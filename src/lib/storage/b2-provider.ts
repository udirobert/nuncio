import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { MediaStorageProvider } from "./types";

/**
 * Backblaze B2 media storage provider.
 *
 * B2 is S3-compatible, so we use the AWS SDK v3 pointed at the B2 endpoint.
 * Stores rendered videos, audio assets, thumbnails, and pipeline traces as
 * the primary durable media store. Public read access is enabled per-bucket
 * so returned URLs are served directly to recipients.
 *
 * Env vars:
 *   B2_KEY_ID          — application key ID (access key)
 *   B2_APPLICATION_KEY — application key (secret)
 *   B2_BUCKET_NAME     — target bucket
 *   B2_ENDPOINT        — e.g. https://s3.us-west-004.backblazeb2.com
 *   B2_PUBLIC_URL      — optional friendly URL prefix (e.g. CDN / bucket subdomain)
 */
export class B2MediaStorageProvider implements MediaStorageProvider {
  readonly name = "b2";
  private client: S3Client;
  private bucket: string;
  private publicBase: string;

  constructor() {
    const keyId = process.env.B2_KEY_ID;
    const appKey = process.env.B2_APPLICATION_KEY;
    const endpoint = process.env.B2_ENDPOINT;
    const bucket = process.env.B2_BUCKET_NAME;

    if (!keyId || !appKey || !endpoint || !bucket) {
      throw new Error(
        "B2 media storage requires B2_KEY_ID, B2_APPLICATION_KEY, B2_ENDPOINT, and B2_BUCKET_NAME"
      );
    }

    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region: "us-west-004",
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    });

    const friendly = process.env.B2_PUBLIC_URL?.replace(/\/$/, "");
    this.publicBase = friendly || `${endpoint.replace(/\/$/, "")}/${bucket}`;
  }

  async upload(
    key: string,
    buffer: Buffer | Uint8Array,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const body = buffer instanceof Uint8Array ? Buffer.from(buffer) : buffer;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // User-defined metadata is stored on the B2 object and returned on
        // GET/HEAD as x-amz-meta-* headers. Enables server-side filtering,
        // auditing, and provenance lookups without downloading the asset.
        ...(metadata && Object.keys(metadata).length > 0
          ? { Metadata: metadata }
          : {}),
      })
    );
    return this.getPublicUrl(key);
  }

  getPublicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  async listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }
}

/** Whether B2 media storage is configured. */
export function isB2Configured(): boolean {
  return Boolean(
    process.env.B2_KEY_ID &&
      process.env.B2_APPLICATION_KEY &&
      process.env.B2_ENDPOINT &&
      process.env.B2_BUCKET_NAME
  );
}
