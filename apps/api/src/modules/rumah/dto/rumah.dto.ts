import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

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

export class UpdateRumahDto {
  @IsString({ message: 'Nama kos harus berupa teks.' })
  @IsOptional()
  @MaxLength(100, { message: 'Nama kos maksimal 100 karakter.' })
  nama?: string;

  @IsString({ message: 'Alamat harus berupa teks.' })
  @IsOptional()
  @MaxLength(255, { message: 'Alamat maksimal 255 karakter.' })
  alamat?: string;

  @IsInt({ message: 'Biaya kos harus berupa angka.' })
  @IsOptional()
  @Min(0, { message: 'Biaya kos tidak boleh negatif.' })
  biayaKos?: number;

  @IsInt({ message: 'Biaya WiFi harus berupa angka.' })
  @IsOptional()
  @Min(0, { message: 'Biaya WiFi tidak boleh negatif.' })
  biayaWifi?: number;

  @IsInt({ message: 'Biaya listrik wajib harus berupa angka.' })
  @IsOptional()
  @Min(0, { message: 'Biaya listrik wajib tidak boleh negatif.' })
  biayaListrikWajib?: number;

  @IsInt({ message: 'Nominal denda harus berupa angka.' })
  @IsOptional()
  @Min(0, { message: 'Nominal denda tidak boleh negatif.' })
  nominalDenda?: number;

  @IsString({ message: 'Nama bank harus berupa teks.' })
  @IsOptional()
  @MaxLength(50, { message: 'Nama bank maksimal 50 karakter.' })
  rekeningBank?: string;

  @IsString({ message: 'Nomor rekening harus berupa teks.' })
  @IsOptional()
  @MaxLength(30, { message: 'Nomor rekening maksimal 30 karakter.' })
  rekeningNomor?: string;

  @IsString({ message: 'Nama pemilik rekening harus berupa teks.' })
  @IsOptional()
  @MaxLength(100, { message: 'Nama pemilik rekening maksimal 100 karakter.' })
  rekeningNama?: string;
}

export class SetQrisDto {
  @IsString({ message: 'URL QRIS harus berupa teks.' })
  @IsNotEmpty({ message: 'URL QRIS wajib diisi.' })
  qrisUrl: string;
}

export class RemoveAnggotaParamDto {
  @IsString({ message: 'ID anggota harus berupa teks.' })
  @IsNotEmpty({ message: 'ID anggota wajib diisi.' })
  anggotaId: string;
}
