import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSwapDto {
  @IsString({ message: 'Tanggal harus berupa teks.' })
  @IsNotEmpty({ message: 'Tanggal wajib diisi (YYYY-MM-DD).' })
  tanggal: string;

  @IsString({ message: 'Tanggal penerima harus berupa teks.' })
  @IsNotEmpty({ message: 'Tanggal penerima wajib diisi (YYYY-MM-DD).' })
  tanggalKe: string;

  @IsString({ message: 'ID anggota penerima harus berupa teks.' })
  @IsNotEmpty({ message: 'ID anggota penerima wajib diisi.' })
  keAnggotaId: string;
}
