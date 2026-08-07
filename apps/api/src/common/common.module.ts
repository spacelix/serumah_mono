import { Global, Module } from '@nestjs/common';
import { RumahScopeService } from './services/rumah-scope.service';

@Global()
@Module({
  providers: [RumahScopeService],
  exports: [RumahScopeService],
})
export class CommonModule {}
