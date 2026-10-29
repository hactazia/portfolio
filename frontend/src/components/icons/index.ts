import {
  FaArrowRight,
  FaEnvelope,
  FaMapMarkerAlt,
  FaTerminal,
  FaFileAlt,
  FaCode,
  FaRocket,
  FaMicrochip,
  FaBolt,
  FaStar,
  FaExternalLinkAlt,
  FaBox,
  FaCommentDots,
  FaLayerGroup,
  FaGithub,
  FaLinkedin,
  FaChevronDown,
  FaMailBulk,
  FaGlobe,
  FaMagic,
} from 'react-icons/fa';
import {
  MdCode,
  MdTerminal,
  MdRocketLaunch,
  MdMemory,
  MdSpeed,
  MdCloud,
  MdLayers,
  MdWeb,
} from 'react-icons/md';
import * as Fa from 'react-icons/fa';
import * as Md from 'react-icons/md';
import * as Si from 'react-icons/si';

export const icons = {
  link: Md.MdLink,
  projets: Md.MdFolderSpecial,
  fee: Md.MdCode,
  book: Md.MdBook,
  socials: {
    discord: Fa.FaDiscord,
    email: Md.MdMail,
    github: Fa.FaGithub,
    linkedin: Fa.FaLinkedin,
    vrchat: Si.SiVrchat,
    mastodon: Fa.FaMastodon,
  },

  // Navigation & UI
  arrowRight: FaArrowRight,
  mail: FaEnvelope,
  mapPin: FaMapMarkerAlt,
  sparkles: FaMagic,
  terminal: FaTerminal,
  fileText: FaFileAlt,
  code: FaCode,
  rocket: FaRocket,
  cpu: FaMicrochip,
  zap: FaBolt,
  star: FaStar,
  externalLink: FaExternalLinkAlt,
  box: FaBox,
  messageSquare: FaCommentDots,
  layers: FaLayerGroup,
  chevronDown: FaChevronDown,
  mailBulk: FaMailBulk,
  globe: FaGlobe,

  // Stack icons (Material Design filled)
  stack: {
    nextjs: MdWeb,
    typescript: MdTerminal,
    threejs: MdMemory,
    webgl: MdRocketLaunch,
    nodejs: MdSpeed,
    docker: MdCloud,
    nestjs: MdLayers,
    react: MdCode,
  },

  // Service icons
  service: {
    web: FaCode,
    vr: FaRocket,
    backend: FaMicrochip,
  },
};

export type IconName = keyof typeof icons;
export type StackIconName = keyof typeof icons.stack;
export type ServiceIconName = keyof typeof icons.service;
