import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
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

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('folder') folder: string,
  ): Promise<{ url: string; key: string }> {
    if (!file) {
      throw new BadRequestException('File wajib diunggah.');
    }
    if (!ALLOWED_FOLDERS.includes(folder as AllowedFolder)) {
      throw new BadRequestException('Folder tidak valid.');
    }

    const ext = this.extensionOf(file.originalname);
    const key = `${folder}/${randomUUID()}${ext}`;
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
}
