import { IsIn, IsString } from 'class-validator';

/**
 * Status weekend untuk SELURUH akhir pekan (Sabtu + Minggu) — 1 pilihan
 * berlaku untuk kedua hari (locked 2026-08-11). Backend meng-set weekendStatus
 * untuk hari `sabtu` dan `minggu` sekaligus dengan nilai yang sama.
 */
export class WeekendStatusDto {
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
