import { Controller, Get } from '@nestjs/common';
import type { PortfolioResponse } from '@portfolio/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/portfolio')
  getPortfolio(): PortfolioResponse {
    return this.appService.getPortfolio();
  }
}
