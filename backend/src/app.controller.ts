import { Controller, Get, Post, Body, Inject } from '@nestjs/common';
import { AppService } from './app.service.js';
import { DbModule, KYSELY_DB } from './db/db.module.js';
import { Kysely } from 'kysely';
import type { DB } from './db/types.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(KYSELY_DB) private readonly db: Kysely<DB>,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'pawnder-backend',
      db_connected: DbModule.isConnected,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('analytics/event')
  async trackPublicEvent(
    @Body() body: { eventName: string; properties?: unknown },
  ) {
    if (!body?.eventName) return { ok: false };
    if (!DbModule.isConnected) return { ok: true };
    try {
      await this.db
        .insertInto('user_events')
        .values({
          user_id: null,
          event_name: body.eventName,
          properties: body.properties ? JSON.stringify(body.properties) : null,
        })
        .execute();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}

