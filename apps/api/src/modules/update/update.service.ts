import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Mirrors the GitHub Releases `version.json` manifest (see
 * `.github/workflows/release.yml`). Served so the app can be pointed at the
 * API instead of GitHub in non-store environments.
 */
@Injectable()
export class UpdateService {
  constructor(private readonly config: ConfigService) {}

  manifest() {
    const versionCode = Number(
      this.config.get<string>('APP_VERSION_CODE') ?? '3',
    );
    const versionName = this.config.get<string>('APP_VERSION_NAME') ?? '1.0.2';
    const minVersionCode = Number(
      this.config.get<string>('APP_MIN_VERSION_CODE') ?? '1',
    );
    const apkUrl =
      this.config.get<string>('APP_APK_URL') ??
      'https://github.com/spacelix/serumah_mono/releases/latest/download/serumah-app.apk';

    return {
      versionCode,
      versionName,
      minVersionCode,
      apkUrl,
      notes: 'Pembaruan aplikasi Serumah.',
    };
  }
}
