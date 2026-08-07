import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;

  @IsString({ message: 'Password harus berupa teks.' })
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  password: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;

  @IsString({ message: 'Password harus berupa teks.' })
  @IsNotEmpty({ message: 'Password wajib diisi.' })
  password: string;
}

export class ChangePasswordDto {
  @IsString({ message: 'Password lama harus berupa teks.' })
  @IsNotEmpty({ message: 'Password lama wajib diisi.' })
  passwordLama: string;

  @IsString({ message: 'Password baru harus berupa teks.' })
  @MinLength(8, { message: 'Password baru minimal 8 karakter.' })
  passwordBaru: string;
}
