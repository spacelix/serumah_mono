import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { StorageService } from './storage.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_FOLDERS = [
  'piket',
  'denda-bukti',
  'qris',
  'iuran-bukti',
  'iuran-pelunasan',
  'listrik',
  'avatar',
] as const;

export type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Public()
  @Get('stream/:key')
  async stream(@Param('key') key: string, @Res() res: Response): Promise<void> {
    return this.storageService.stream(decodeURIComponent(key), res);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('folder') folder: string,
    @Body('path') path?: string,
  ): Promise<{ url: string; key: string }> {
    if (!file) {
      throw new BadRequestException('File wajib diunggah.');
    }
    if (!ALLOWED_FOLDERS.includes(folder as AllowedFolder)) {
      throw new BadRequestException('Folder tidak valid.');
    }

    const key = this.resolveKey(folder, path, file.originalname);
    const url = await this.storageService.upload(
      file.buffer,
      key,
      file.mimetype,
    );

    return { url, key };
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ): Promise<{ url: string; key: string }> {
    if (!file) {
      throw new BadRequestException('File wajib diunggah.');
    }

    const ext = this.extensionOf(file.originalname);
    const key = `profiles/${payload.userId}/avatar${ext}`;
    const url = await this.storageService.upload(
      file.buffer,
      key,
      file.mimetype,
    );

    return { url, key };
  }

  private extensionOf(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.slice(dot) : '';
  }

  /**
   * Resolve the object key. When the client supplies a `path` (deterministic
   * key, e.g. `photos/{submissionId}/{roomId}_{type}_{ts}.jpg`), it is used
   * verbatim after validating it stays under the allowed folder. Otherwise a
   * random UUID key under `folder/` is generated.
   */
  private resolveKey(
    folder: string,
    path: string | undefined,
    originalname: string,
  ): string {
    if (!path) {
      const ext = this.extensionOf(originalname);
      return `${folder}/${randomUUID()}${ext}`;
    }
    const normalized = path.replace(/^\/+/, '');
    if (!normalized.startsWith(`${folder}/`)) {
      throw new BadRequestException(
        'Path harus berada di dalam folder yang dipilih.',
      );
    }
    if (!normalized.includes('.') || normalized.includes('..')) {
      throw new BadRequestException('Path file tidak valid.');
    }
    return normalized;
  }
}
