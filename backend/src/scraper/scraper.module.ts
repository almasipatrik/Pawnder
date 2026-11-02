import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service.js';
import { ScraperController } from './scraper.controller.js';

@Module({
  controllers: [ScraperController],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}

