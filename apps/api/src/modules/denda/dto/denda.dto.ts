import { IsNotEmpty, IsString } from 'class-validator';

export class UploadBuktiDto {
  @IsString({ message: 'URL bukti harus berupa teks.' })
  @IsNotEmpty({ message: 'URL bukti wajib diisi.' })
  buktiUrl: string;
}
