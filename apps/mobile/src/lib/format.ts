export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** "Sabtu, 1 Agu" — for weekend day rows */
export function formatWeekdayDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '');
}

/** "Juli 2026" — for the billing month label */
export function formatMonthYear(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Day number e.g. "27" — for schedule date chips */
export function formatDayNumber(iso: string): string {
  return String(new Date(iso).getDate()).padStart(2, '0');
}

/** "27 Jul – 2 Agu" — schedule week range, both ends day+month */
export function formatWeekRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
      .format(new Date(iso))
      .replace('.', '');
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

/** "16 Jul 21:04" — resolved-at stamp in swap history */
export function formatDateTimeShort(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '');
  const time = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace('.', ':');
  return `${day} ${time}`;
}

/** Nama depan (kata pertama) — untuk chip/avatar yang ruangnya sempit. */
export function firstName(nama: string): string {
  return nama.trim().split(/\s+/)[0] ?? nama;
}
