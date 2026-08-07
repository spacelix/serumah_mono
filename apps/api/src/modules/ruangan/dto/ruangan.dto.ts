import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRuanganDto {
  @IsString({ message: 'Nama ruangan harus berupa teks.' })
  @IsNotEmpty({ message: 'Nama ruangan wajib diisi.' })
  @MaxLength(100, { message: 'Nama ruangan maksimal 100 karakter.' })
  nama: string;
}

export class UpdateRuanganDto {
  @IsString({ message: 'Nama ruangan harus berupa teks.' })
  @IsNotEmpty({ message: 'Nama ruangan wajib diisi.' })
  @MaxLength(100, { message: 'Nama ruangan maksimal 100 karakter.' })
  nama: string;
}

export class ReorderRuanganDto {
  @IsArray({ message: 'Urutan harus berupa daftar ID ruangan.' })
  @IsString({ each: true, message: 'ID ruangan harus berupa teks.' })
  @IsNotEmpty({ each: true, message: 'ID ruangan tidak boleh kosong.' })
  urutan: string[];
}

export class CreateJenisPiketDto {
  @IsString({ message: 'Nama jenis piket harus berupa teks.' })
  @IsNotEmpty({ message: 'Nama jenis piket wajib diisi.' })
  @MaxLength(100, { message: 'Nama jenis piket maksimal 100 karakter.' })
  nama: string;
}

export class UpdateJenisPiketDto {
  @IsString({ message: 'Nama jenis piket harus berupa teks.' })
  @IsNotEmpty({ message: 'Nama jenis piket wajib diisi.' })
  @MaxLength(100, { message: 'Nama jenis piket maksimal 100 karakter.' })
  nama: string;

  @IsBoolean({ message: 'Status aktif harus berupa nilai benar/salah.' })
  @IsOptional()
  isActive?: boolean;
}

export class CreateJenisPiketBulkDto {
  @IsArray({ message: 'Daftar jenis piket harus berupa array.' })
  @IsString({ each: true, message: 'Nama jenis piket harus berupa teks.' })
  @IsNotEmpty({ each: true, message: 'Nama jenis piket tidak boleh kosong.' })
  nama: string[];

  @IsInt({ message: 'Urutan awal harus berupa angka.' })
  @Min(0, { message: 'Urutan awal minimal 0.' })
  @IsOptional()
  mulaiUrutan?: number;
}
