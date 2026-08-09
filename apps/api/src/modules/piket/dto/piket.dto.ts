import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Partial-submit: photos + checklist are OPTIONAL here; the service enforces
// "a room with any activity must have both photos + ≥1 checked jenis" and
// "a room with zero activity is not worked" (its items count toward the fine).
export class RuanganProofDto {
  @IsString({ message: 'ID ruangan harus berupa teks.' })
  @IsNotEmpty({ message: 'ID ruangan wajib diisi.' })
  ruanganId: string;

  @IsOptional()
  @IsString({ message: 'URL foto sebelum harus berupa teks.' })
  fotoBeforeUrl?: string;

  @IsOptional()
  @IsString({ message: 'URL foto sesudah harus berupa teks.' })
  fotoAfterUrl?: string;

  @IsOptional()
  @IsArray({ message: 'Jenis selesai harus berupa daftar.' })
  @IsString({ each: true, message: 'Jenis selesai harus berupa teks.' })
  jenisSelesai?: string[];
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
