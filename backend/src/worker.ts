import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ScraperService } from './scraper/scraper.service.js';

/**
 * Standalone Background Worker (Docker Container Entrypoint)
 * Connects directly to PostgreSQL via DATABASE_URL,
 * syncs shelter dogs & cats, creates new animals, updates existing ones,
 * and marks adopted/removed animals as is_adopted = true.
 */
async function runWorker() {
  const logger = new Logger('PawnderScraperWorker');
  logger.log('Initializing Pawnder Background Scraper Worker...');

  const appContext = await NestFactory.createApplicationContext(AppModule);
  const scraperService = appContext.get(ScraperService);

  const intervalMinutes = Number(process.env.SCRAPER_INTERVAL_MINUTES || 240); // Default: every 4 hours
  const maxPagesPerSpecies = Number(
    process.env.SCRAPER_MAX_PAGES || process.env.SCRAPER_MAX_PAGES_PER_SPECIES || 25,
  );
  const verifyExistingSampleLimit = Number(
    process.env.SCRAPER_VERIFY_REMOVED_BATCH || 100,
  );
  const runOnce =
    process.env.SCRAPER_RUN_ONCE === 'true' || process.env.RUN_ONCE === 'true';

  const executeJob = async () => {
    try {
      logger.log(
        `Starting scheduled allatok.info RDS database sync (maxPagesPerSpecies=${maxPagesPerSpecies}, verifyBatch=${verifyExistingSampleLimit})...`,
      );
      const result = await scraperService.syncAllAnimals({
        maxPagesPerSpecies,
        verifyExistingSampleLimit,
      });
      logger.log(`Sync job finished: ${JSON.stringify(result)}`);
    } catch (err: any) {
      logger.error(`Sync job error: ${err?.message}`);
    }
  };

  // Run immediately on container startup
  await executeJob();

  if (runOnce) {
    logger.log('RUN_ONCE=true set. Closing worker context.');
    await appContext.close();
    process.exit(0);
  }

  logger.log(
    `Worker scheduled to run every ${intervalMinutes} minutes. Waiting for next cycle...`,
  );
  setInterval(executeJob, intervalMinutes * 60 * 1000);
}

runWorker();

