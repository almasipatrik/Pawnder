import {
  Inject,
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Kysely } from 'kysely';
import type { DB, UserPreferences } from '../db/types.js';
import { DbModule, KYSELY_DB } from '../db/db.module.js';
import { resolveHungarianCoords } from '../db/hu-locations.js';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service.js';

export interface MemoryUser {
  id: string;
  email: string;
  name: string | null;
  city: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  max_distance_km: number;
  preferences_json: UserPreferences;
  created_at: Date;
}

@Injectable()
export class AuthService {
  // In-memory fallback when local PostgreSQL is not running
  public static memoryUsers = new Map<string, MemoryUser>();
  private memoryOtpCodes: Array<{
    id: string;
    email: string;
    code: string;
    expires_at: Date;
    used: boolean;
    created_at: Date;
  }> = [];
  private memoryRefreshTokens = new Map<
    string,
    { user_id: string; token: string; expires_at: Date; revoked: boolean }
  >();

  constructor(
    @Inject(KYSELY_DB) private readonly db: Kysely<DB>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async requestOtp(email: string) {
    if (!email || !email.includes('@')) {
      throw new HttpException('Érvényes e-mail cím megadása kötelező.', HttpStatus.BAD_REQUEST);
    }
    const cleanEmail = email.trim().toLowerCase();
    const isDev = process.env.NODE_ENV !== 'production';

    // In production, enforce 30s cooldown per email
    if (!isDev && DbModule.isConnected) {
      const oneMinuteAgo = new Date(Date.now() - 30 * 1000); // 30s cooldown
      const recentOtp = await this.db
        .selectFrom('otp_codes')
        .selectAll()
        .where('email', '=', cleanEmail)
        .where('created_at', '>', oneMinuteAgo)
        .executeTakeFirst();

      if (recentOtp) {
        throw new HttpException(
          'Kérjük, várj 30 másodpercet az új kód igénylése előtt!',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (DbModule.isConnected) {
      await this.db
        .insertInto('otp_codes')
        .values({ email: cleanEmail, code, expires_at: expiresAt, used: false })
        .execute();
    } else {
      this.memoryOtpCodes.push({
        id: randomUUID(),
        email: cleanEmail,
        code,
        expires_at: expiresAt,
        used: false,
        created_at: new Date(),
      });
    }

    if (!isDev) {
      await this.mailService.sendOtpEmail(cleanEmail, code);
    } else {
      // In development, do not block on or require sending an email.
      // Attempt in background if Mailpit is available, but never block or fail the request.
      this.mailService.sendOtpEmail(cleanEmail, code).catch((err) => {
        console.warn(`[Pawnder DEV] Email sending skipped/optional: ${err.message}`);
      });
    }

    console.log(`\n========================================`);
    console.log(`[Pawnder OTP] Belépési kód (${cleanEmail}): ${code}`);
    console.log(`========================================\n`);

    return {
      message: isDev
        ? 'Fejlesztői módban a kód automatikusan generálva és betöltve!'
        : 'A 6-jegyű belépési kódot elküldtük az e-mail címedre!',
      dev_code: isDev ? code : undefined,
    };
  }

  async verifyOtp(email: string, code: string) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    let user: any = null;

    if (DbModule.isConnected) {
      const record = await this.db
        .selectFrom('otp_codes')
        .selectAll()
        .where('email', '=', cleanEmail)
        .where('code', '=', cleanCode)
        .where('used', '=', false)
        .where('expires_at', '>', new Date())
        .orderBy('created_at', 'desc')
        .executeTakeFirst();

      if (!record) {
        throw new UnauthorizedException('Érvénytelen vagy lejárt belépési kód.');
      }

      await this.db
        .updateTable('otp_codes')
        .set({ used: true })
        .where('id', '=', record.id)
        .execute();

      user = await this.db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', cleanEmail)
        .executeTakeFirst();

      if (!user) {
        user = await this.db
          .insertInto('users')
          .values({
            email: cleanEmail,
            city: 'Dunaharaszti',
            postal_code: '2330',
            lat: 47.3553,
            lng: 19.0838,
            max_distance_km: 150,
            preferences_json: JSON.stringify({
              species: 'mindegy',
              breed: 'Any',
              fromyear: 0,
              toyear: 99,
              gender: 'Any',
              peopleok: 'Any',
              size: 'Any',
              kidsok: 'Any',
              housebroken: 'Any',
              malesok: 'Any',
              keepin: 'Any',
              femalesok: 'Any',
              spayed: 'Any',
              shelter_id: 'Any',
              max_distance_km: 150,
              min_match_percent: 70,
              traits: { playfulness: 4, activity: 3, trainability: 4, temperament: 3 },
            }),
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      }
    } else {
      const record = [...this.memoryOtpCodes]
        .reverse()
        .find(
          (r) =>
            r.email === cleanEmail &&
            r.code === cleanCode &&
            !r.used &&
            r.expires_at > new Date(),
        );

      if (!record) {
        throw new UnauthorizedException('Érvénytelen vagy lejárt belépési kód.');
      }
      record.used = true;

      let existing = Array.from(AuthService.memoryUsers.values()).find(
        (u) => u.email === cleanEmail,
      );
      if (!existing) {
        existing = {
          id: randomUUID(),
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          city: 'Dunaharaszti',
          postal_code: '2330',
          lat: 47.3553,
          lng: 19.0838,
          max_distance_km: 150,
          preferences_json: {
            species: 'mindegy',
            breed: 'Any',
            fromyear: 0,
            toyear: 99,
            gender: 'Any',
            peopleok: 'Any',
            size: 'Any',
            kidsok: 'Any',
            housebroken: 'Any',
            malesok: 'Any',
            keepin: 'Any',
            femalesok: 'Any',
            spayed: 'Any',
            shelter_id: 'Any',
            max_distance_km: 150,
            min_match_percent: 70,
            traits: { playfulness: 4, activity: 3, trainability: 4, temperament: 3 },
          },
          created_at: new Date(),
        };
        AuthService.memoryUsers.set(existing.id, existing);
      }
      user = existing;
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: '7d' },
    );

    const refreshToken = randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (DbModule.isConnected) {
      await this.db
        .insertInto('refresh_tokens')
        .values({
          user_id: user.id,
          token: refreshToken,
          expires_at: refreshExpiresAt,
          revoked: false,
        })
        .execute();
    } else {
      this.memoryRefreshTokens.set(refreshToken, {
        user_id: user.id,
        token: refreshToken,
        expires_at: refreshExpiresAt,
        revoked: false,
      });
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  async refreshAccessToken(oldRefreshToken: string) {
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Hiányzó refresh token.');
    }
    const cleanToken = oldRefreshToken.trim();

    if (DbModule.isConnected) {
      const record = await this.db
        .selectFrom('refresh_tokens')
        .selectAll()
        .where('token', '=', cleanToken)
        .where('revoked', '=', false)
        .where('expires_at', '>', new Date())
        .executeTakeFirst();

      if (!record) {
        throw new UnauthorizedException('A munkamenet lejárt. Kérjük, jelentkezz be újra!');
      }

      await this.db
        .updateTable('refresh_tokens')
        .set({ revoked: true })
        .where('id', '=', record.id)
        .execute();

      const user = await this.db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', record.user_id)
        .executeTakeFirst();

      if (!user) {
        throw new UnauthorizedException('A felhasználó nem található.');
      }

      const newAccessToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        { expiresIn: '7d' },
      );
      const newRefreshToken = randomBytes(40).toString('hex');
      await this.db
        .insertInto('refresh_tokens')
        .values({
          user_id: user.id,
          token: newRefreshToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revoked: false,
        })
        .execute();

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        user,
      };
    } else {
      const rec = this.memoryRefreshTokens.get(cleanToken);
      if (!rec || rec.revoked || rec.expires_at <= new Date()) {
        throw new UnauthorizedException('A munkamenet lejárt.');
      }
      rec.revoked = true;
      const user = AuthService.memoryUsers.get(rec.user_id);
      if (!user) throw new UnauthorizedException('A felhasználó nem található.');

      const newAccessToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        { expiresIn: '7d' },
      );
      const newRefreshToken = randomBytes(40).toString('hex');
      this.memoryRefreshTokens.set(newRefreshToken, {
        user_id: user.id,
        token: newRefreshToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revoked: false,
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        user,
      };
    }
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      if (DbModule.isConnected) {
        await this.db
          .updateTable('refresh_tokens')
          .set({ revoked: true })
          .where('token', '=', refreshToken.trim())
          .execute();
      } else {
        const rec = this.memoryRefreshTokens.get(refreshToken.trim());
        if (rec) rec.revoked = true;
      }
    }
    return { success: true, message: 'Sikeres kijelentkezés.' };
  }

  async getProfile(userId: string) {
    if (DbModule.isConnected) {
      const user = await this.db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirst();
      if (!user) throw new UnauthorizedException('Felhasználó nem található.');
      return user;
    } else {
      const user = AuthService.memoryUsers.get(userId);
      if (!user) throw new UnauthorizedException('Felhasználó nem található.');
      return user;
    }
  }

  async updateProfile(
    userId: string,
    body: {
      name?: string;
      city?: string;
      postal_code?: string;
      lat?: number;
      lng?: number;
      max_distance_km?: number;
      preferences_json?: UserPreferences;
    },
  ) {
    let resolvedLat = body.lat;
    let resolvedLng = body.lng;

    if ((resolvedLat === undefined || resolvedLng === undefined) && (body.city || body.postal_code)) {
      const [cLat, cLng] = resolveHungarianCoords(body.city, undefined, undefined, body.postal_code);
      resolvedLat = cLat;
      resolvedLng = cLng;
    }

    if (DbModule.isConnected) {
      const updateData: Record<string, any> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.city !== undefined) updateData.city = body.city;
      if (body.postal_code !== undefined) updateData.postal_code = body.postal_code;
      if (resolvedLat !== undefined) updateData.lat = resolvedLat;
      if (resolvedLng !== undefined) updateData.lng = resolvedLng;
      if (body.max_distance_km !== undefined) updateData.max_distance_km = Number(body.max_distance_km);
      if (body.preferences_json !== undefined) {
        updateData.preferences_json = JSON.stringify(body.preferences_json);
      }

      const updated = await this.db
        .updateTable('users')
        .set(updateData)
        .where('id', '=', userId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) throw new UnauthorizedException('Felhasználó nem található.');
      return updated;
    } else {
      const user = AuthService.memoryUsers.get(userId);
      if (!user) throw new UnauthorizedException('Felhasználó nem található.');
      if (body.name !== undefined) user.name = body.name;
      if (body.city !== undefined) user.city = body.city;
      if (body.postal_code !== undefined) user.postal_code = body.postal_code;
      if (resolvedLat !== undefined) user.lat = resolvedLat;
      if (resolvedLng !== undefined) user.lng = resolvedLng;
      if (body.max_distance_km !== undefined) user.max_distance_km = Number(body.max_distance_km);
      if (body.preferences_json !== undefined) user.preferences_json = body.preferences_json;
      return user;
    }
  }

  /**
   * GDPR 17. cikk ("Elfeledtetéshez való jog") — A felhasználó saját fiókjának és
   * minden személyes adatának (preferenciák, húzások/matchek, OTP kódok, tokenek) végleges törlése.
   */
  async deleteAccount(userId: string) {
    if (DbModule.isConnected) {
      const user = await this.db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirst();

      if (!user) {
        throw new UnauthorizedException('A felhasználói fiók már nem létezik.');
      }

      // Delete OTP codes associated with user's email
      await this.db
        .deleteFrom('otp_codes')
        .where('email', '=', user.email)
        .execute();

      // Delete user (refresh_tokens and user_swipes cascade automatically via FK ON DELETE CASCADE)
      await this.db
        .deleteFrom('users')
        .where('id', '=', userId)
        .execute();

      return {
        success: true,
        message: 'A felhasználói fiókod és minden hozzá tartozó személyes adatod véglegesen törlésre került a GDPR előírásainak megfelelően.',
      };
    } else {
      const user = AuthService.memoryUsers.get(userId);
      if (user) {
        this.memoryOtpCodes = this.memoryOtpCodes.filter((o) => o.email !== user.email);
        AuthService.memoryUsers.delete(userId);
      }
      return {
        success: true,
        message: 'A felhasználói fiókod és minden hozzá tartozó személyes adatod véglegesen törlésre került.',
      };
    }
  }
}
