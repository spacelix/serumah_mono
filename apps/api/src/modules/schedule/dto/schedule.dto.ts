import { IsIn, IsString } from 'class-validator';

export class WeekendStatusDto {
  @IsString({ message: 'Hari harus berupa teks.' })
  @IsIn(['sabtu', 'minggu'], {
    message: 'Hari harus sabtu atau minggu.',
  })
  hari: 'sabtu' | 'minggu';

  @IsString({ message: 'Status harus berupa teks.' })
  @IsIn(['di_kos', 'pulang'], {
    message: 'Status harus di_kos atau pulang.',
  })
  status: 'di_kos' | 'pulang';
}

export class RunAutoFineDto {
  @IsString({ message: 'Tanggal harus berupa teks.' })
  tanggal: string;
}
