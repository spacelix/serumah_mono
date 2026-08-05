import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class CreateRumahDto {
  @IsString({ message: 'Nama kos harus berupa teks.' })
  @IsNotEmpty({ message: 'Nama kos wajib diisi.' })
  @MaxLength(100, { message: 'Nama kos maksimal 100 karakter.' })
  nama: string;

  @IsString({ message: 'Alamat harus berupa teks.' })
  @IsNotEmpty({ message: 'Alamat kos wajib diisi.' })
  @MaxLength(255, { message: 'Alamat maksimal 255 karakter.' })
  alamat: string;
}

export class JoinRumahDto {
  @IsString({ message: 'Kode undangan harus berupa teks.' })
  @Length(6, 6, { message: 'Kode undangan harus 6 karakter.' })
  inviteCode: string;
}
