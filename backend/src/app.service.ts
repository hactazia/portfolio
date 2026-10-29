import { Injectable } from '@nestjs/common';
import type { PortfolioResponse } from '@portfolio/common';

@Injectable()
export class AppService {
  getPortfolio(): PortfolioResponse {
    return {
      server: {
        url: process.env.FRONTEND_URL?.split(',')[0] || '',
      },
      profile: {
        name: 'Hactazia',
        role: 'Développeur Unity',
        location: 'France · Disponible à distance',
        bio: '',
        socials: [
          {
            type: 'email',
            label: 'Mail',
            value: 'mailto:contact@hactazia.fr',
          },
          {
            type: 'discord',
            label: 'Discord',
            value: 'https://discord.com/users/hactazia',
          },
          {
            type: 'github',
            label: 'Github',
            value: 'https://github.com/hactazia',
          },
          {
            type: 'vrchat',
            label: 'VRChat',
            value:
              'https://vrchat.com/home/user/usr_b59713dd-02ef-424c-afa8-78b60c2d5119',
          },
          {
            type: 'mastodon',
            label: 'Mastodon',
            value: 'https://masto.hactazia.fr/@hactazia',
          },
        ],
      },
      fee: {
        available: true,
      },
      projects: [
        {
          slug: 'vr',
          name: 'Réalité virtuelle',
          projects: [
            {
              slug: 'nox',
              title: 'Nox Project',
              description: 'A federated, open-source Social VR platform.',
              image: 'https://avatars.githubusercontent.com/u/156438198',
              url: 'https://github.com/AtelierVR/',
              year: null,
              tags: [],
            },
            {
              slug: 'vrcx',
              title: 'VRCX',
              description: 'Contributing to a Friendship Manager of VRChat.',
              image:
                'https://raw.githubusercontent.com/vrcx-team/VRCX/master/images/VRCX.ico',
              url: 'https://github.com/hactazia/VRCX',
              year: 2025,
              tags: [],
            },
            {
              slug: 'openvr-mqtt',
              title: 'OpenVR MQTT',
              description: 'Minimal OpenVR/SteamVR driver written in Rust that publishes MQTT messages when SteamVR starts and stops.',
              image: null,
              url: 'https://github.com/hactazia/openvr-mqtt',
              year: 2026,
              tags: [],
            },
          ],
        },
        {
          slug: 'other',
          name: 'Others',
          projects: [
            {
              slug: 'proxichat',
              title: 'Proximity-Based Voice Chat',
              description:
                'This project aims to add proximity-based voice chat by bringing a web-based platform.',
              image: null,
              url: 'https://github.com/hactazia/proxichat',
              year: null,
              tags: [],
            },
            {
              slug: 'monopoly-ia-matchup',
              title: 'MonopolyIA - LLM Matchup Arena',
              description:
                'A cutting-edge framework for evaluating Large Language Models (LLMs) performance through Monopoly gameplay.',
              image:
                'https://github.com/hactazia/monopoly-ia-matchup/raw/main/static/img/header.jpg',
              url: 'https://github.com/hactazia/monopoly-ia-matchup',
              year: 2025,
              tags: [],
            },
          ],
        },
      ],
    };
  }
}
