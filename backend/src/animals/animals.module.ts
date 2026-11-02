import { Module } from '@nestjs/common';
import { AnimalsService } from './animals.service.js';
import { AnimalsController } from './animals.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [AnimalsController],
  providers: [AnimalsService],
  exports: [AnimalsService],
})
export class AnimalsModule {}

