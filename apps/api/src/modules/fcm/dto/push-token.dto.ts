import { IsNotEmpty, IsString } from 'class-validator';

export class PushTokenDto {
  @IsString({ message: 'Token harus berupa teks.' })
  @IsNotEmpty({ message: 'Token FCM wajib diisi.' })
  token: string;
}
