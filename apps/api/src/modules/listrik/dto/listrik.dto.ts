import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateListrikDto {
  @IsString({ message: 'Bulan harus berupa teks.' })
  @IsNotEmpty({ message: 'Bulan wajib diisi (YYYY-MM).' })
  bulan: string;

  @IsInt({ message: 'Nominal harus berupa angka.' })
  @Min(1, { message: 'Nominal harus lebih dari 0.' })
  nominal: number;

  @IsString({ message: 'Keterangan harus berupa teks.' })
  @IsOptional()
  @MaxLength(255, { message: 'Keterangan maksimal 255 karakter.' })
  keterangan?: string;

  @IsString({ message: 'URL bukti harus berupa teks.' })
  @IsNotEmpty({ message: 'URL bukti wajib diisi.' })
  buktiUrl: string;
}
