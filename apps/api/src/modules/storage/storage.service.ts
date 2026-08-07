import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import type { Response } from 'express';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'serumah';

    this.client = new Minio.Client({
      endPoint: config.get<string>('MINIO_ENDPOINT') ?? 'localhost',
      port: Number(config.get<string>('MINIO_PORT') ?? '9000'),
      useSSL: (config.get<string>('MINIO_USE_SSL') ?? 'false') === 'true',
      accessKey: config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (error) {
      this.logger.warn(
        `[StorageService] MinIO tidak dapat dimulai: ${(error as Error).message}`,
      );
    }
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`[StorageService] Bucket ${this.bucket} created`);
    }
  }

  async upload(
    buffer: Buffer,
    key: string,
    contentType?: string,
  ): Promise<string> {
    await this.client.putObject(this.bucket, key, buffer, undefined, {
      'Content-Type': contentType ?? 'application/octet-stream',
    });
    return this.publicUrl(key);
  }

  /**
   * Public (relative) URL served by this API via `GET /storage/stream/:key`.
   * The mobile client resolves it against its own API origin so it never
   * talks to MinIO/S3 directly.
   */
  publicUrl(key: string): string {
    return `/storage/stream/${encodeURIComponent(key)}`;
  }

  async stream(key: string, res: Response): Promise<void> {
    let stat: Minio.BucketItemStat;
    try {
      stat = await this.client.statObject(this.bucket, key);
    } catch {
      throw new NotFoundException('File tidak ditemukan');
    }
    const contentType =
      (stat.metaData?.['content-type'] as string | undefined) ??
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    const object = await this.client.getObject(this.bucket, key);
    object.on('error', () => {
      res.destroy();
    });
    object.pipe(res);
  }
}
