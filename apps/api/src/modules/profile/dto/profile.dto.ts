import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Nama harus berupa teks.' })
  @MaxLength(100, { message: 'Nama maksimal 100 karakter.' })
  nama?: string;

  @IsOptional()
  @IsString({ message: 'Foto profil tidak valid.' })
  fotoProfil?: string;

  @IsOptional()
  @IsString({ message: 'Kontak darurat harus berupa teks.' })
  @MaxLength(20, { message: 'Kontak darurat maksimal 20 karakter.' })
  kontakDarurat?: string;

  @IsOptional()
  @IsString({ message: 'Alamat harus berupa teks.' })
  @MaxLength(255, { message: 'Alamat maksimal 255 karakter.' })
  alamat?: string;
}
