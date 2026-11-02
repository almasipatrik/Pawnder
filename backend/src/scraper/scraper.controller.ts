import { Controller, Get, Post, Query } from '@nestjs/common';
import { ScraperService } from './scraper.service.js';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Get('status')
  getStatus() {
    return this.scraperService.getStatus();
  }

  @Post('sync')
  triggerSync(@Query('pages') pages?: string) {
    const maxPagesPerSpecies = pages ? Math.max(1, Math.min(150, Number(pages))) : 2;
    return this.scraperService.syncAllAnimals({
      maxPagesPerSpecies,
      verifyExistingSampleLimit: 10,
    });
  }
}

