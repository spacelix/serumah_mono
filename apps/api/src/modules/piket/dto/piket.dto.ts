import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RuanganProofDto {
  @IsString({ message: 'ID ruangan harus berupa teks.' })
  @IsNotEmpty({ message: 'ID ruangan wajib diisi.' })
  ruanganId: string;

  @IsString({ message: 'URL foto sebelum harus berupa teks.' })
  @IsNotEmpty({ message: 'Foto sebelum wajib diunggah.' })
  fotoBeforeUrl: string;

  @IsString({ message: 'URL foto sesudah harus berupa teks.' })
  @IsNotEmpty({ message: 'Foto sesudah wajib diunggah.' })
  fotoAfterUrl: string;

  @IsArray({ message: 'Jenis selesai harus berupa daftar.' })
  @IsString({ each: true, message: 'Jenis selesai harus berupa teks.' })
  @ArrayNotEmpty({ message: 'Pilih minimal satu jenis piket.' })
  jenisSelesai: string[];
}

export class CreateSubmissionDto {
  @IsString({ message: 'ID jadwal harus berupa teks.' })
  @IsNotEmpty({ message: 'ID jadwal wajib diisi.' })
  jadwalId: string;

  @IsArray({ message: 'Bukti ruangan harus berupa daftar.' })
  @ArrayNotEmpty({ message: 'Bukti ruangan tidak boleh kosong.' })
  @ValidateNested({ each: true })
  @Type(() => RuanganProofDto)
  proofs: RuanganProofDto[];
}
