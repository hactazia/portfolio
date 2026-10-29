import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Translate } from '@portfolio/common';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('portfolio', () => {
    it('returns the portfolio contract', () => {
      expect(appController.getPortfolio().profile.name).toBe('Votre nom');
    });
  });
});
