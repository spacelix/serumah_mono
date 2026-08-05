import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class EnsureBulanDto {
  @IsString({ message: 'Bulan harus berupa teks.' })
  @IsNotEmpty({ message: 'Bulan wajib diisi (YYYY-MM).' })
  bulan: string;
}

export class UploadBuktiTotalDto {
  @IsString({ message: 'Bulan harus berupa teks.' })
  @IsNotEmpty({ message: 'Bulan wajib diisi (YYYY-MM).' })
  bulan: string;

  @IsString({ message: 'URL bukti harus berupa teks.' })
  @IsNotEmpty({ message: 'URL bukti wajib diisi.' })
  buktiUrl: string;
}

export class PelunasanDto {
  @IsString({ message: 'Bulan harus berupa teks.' })
  @IsNotEmpty({ message: 'Bulan wajib diisi (YYYY-MM).' })
  bulan: string;

  @IsIn(['kos', 'wifi', 'listrik_wajib'], {
    message: 'Kategori harus kos, wifi, atau listrik_wajib.',
  })
  kategori: string;

  @IsString({ message: 'URL bukti pelunasan harus berupa teks.' })
  @IsNotEmpty({ message: 'URL bukti pelunasan wajib diisi.' })
  buktiLunas: string;
}
