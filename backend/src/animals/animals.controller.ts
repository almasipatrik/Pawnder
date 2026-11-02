import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AnimalsService, type AnimalFilterQuery } from './animals.service.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('animals')
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Get('dropdowns')
  getDropdowns() {
    return this.animalsService.getDropdownOptions();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAnimals(@Query() query: AnimalFilterQuery, @Req() req: any) {
    return this.animalsService.findAnimals(query, req.user?.sub);
  }

  @UseGuards( JwtAuthGuard )
  @Get('matches')
  getMyMatches(@Query() query: AnimalFilterQuery, @Req() req: any) {
    return this.animalsService.getUserMatches(req.user.sub, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('swipe')
  recordSwipe(
    @Req() req: any,
    @Body()
    body: {
      animal_id: string;
      direction: 'right' | 'left';
      match_percent?: number;
    },
  ) {
    return this.animalsService.recordSwipe(
      req.user.sub,
      body.animal_id,
      body.direction,
      body.match_percent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('swipe/:animalId')
  removeSwipe(@Req() req: any, @Param('animalId') animalId: string) {
    return this.animalsService.removeSwipe(req.user.sub, animalId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset-passes')
  resetPasses(@Req() req: any) {
    return this.animalsService.resetLeftSwipes(req.user.sub);
  }

  @Get(':id')
  getAnimalById(@Param('id') id: string, @Query() query: AnimalFilterQuery) {
    return this.animalsService.getAnimalById(id, query);
  }
}

