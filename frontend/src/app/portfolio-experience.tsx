'use client';

import type { Project, Profile } from '@portfolio/common';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

type Props = { initialProfile: Profile; initialProjects: Project[] };

function SkeletonRows() {
  return <div className={styles.skeletonList} aria-label="Chargement des projets"><span /><span /><span /></div>;
}

function VrLab() {
  const [webxr, setWebxr] = useState<boolean | null>(null);

  useEffect(() => {
    setWebxr('xr' in navigator && 'isSessionSupported' in navigator.xr!);
  }, []);

  return <div className={styles.vrLab}>
    <div className={styles.vrOrb} aria-hidden="true"><span>VR</span></div>
    <div><p className={styles.eyebrow}>VR LAB / 01</p><h3>Le web comme terrain d’immersion.</h3><p>Prototypage d’interactions spatiales, expériences WebXR et interfaces pensées pour le mouvement.</p><span className={styles.status}>{webxr === null ? 'Détection du casque…' : webxr ? 'WebXR disponible' : 'WebXR à découvrir'} <i /></span></div>
  </div>;
}

export default function PortfolioExperience({ initialProfile, initialProjects }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [projects, setProjects] = useState(initialProjects);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    setLoading(true);
    fetch(`${apiUrl}/portfolio`).then((response) => response.ok ? response.json() as Promise<{ profile: Profile; projects: Project[] }> : Promise.reject()).then((data) => { setProfile(data.profile); setProjects(data.projects.length ? data.projects : initialProjects); }).catch(() => undefined).finally(() => setLoading(false));
  }, [initialProjects]);

  return <main className={styles.page}>
    <nav className={styles.nav}><a className={styles.mark} href="#top" aria-label="Retour en haut"><b>HA</b><b>CT</b></a><div className={styles.navLinks}><a href="#projets">Projets</a><a href="#vr">VR Lab</a><a href="#contact">Contact</a></div></nav>
    <section className={styles.hero} id="top"><p className={styles.kicker}>Portfolio · 2026 / {profile.location}</p><h1>Je fabrique des mondes <em>à explorer.</em></h1><div className={styles.heroFooter}><p>{profile.bio}</p><a className={styles.arrowLink} href="#projets">Voir les projets <span>↘</span></a></div></section>
    <section className={styles.intro}><p className={styles.sectionLabel}>01 / Profil</p><div><h2>Du code pour créer une présence.</h2><p className={styles.largeCopy}>{profile.role}. Je mêle ingénierie, design d’interaction et curiosité pour construire des expériences qui restent en tête.</p></div></section>
    <section className={styles.projects} id="projets"><div className={styles.sectionHeader}><p className={styles.sectionLabel}>02 / Sélection</p><h2>Projets récents</h2></div><div className={styles.projectList}>{loading ? <SkeletonRows /> : projects.map((project, index) => <a className={styles.project} href={project.href} key={project.slug}><span className={styles.projectNumber}>0{index + 1}</span><span className={styles.projectBody}><span className={styles.projectTitle}>{project.title}</span><span className={styles.projectDescription}>{project.description}</span><span className={styles.tags}>{project.tags.join('  /  ')}</span></span><span className={styles.projectMeta}>{project.year} <span>↗</span></span></a>)}</div></section>
    <section className={styles.vrSection} id="vr"><VrLab /></section>
    <section className={styles.contact} id="contact"><p className={styles.sectionLabel}>03 / Contact</p><h2>Construisons le <em>prochain monde.</em></h2><div className={styles.contactLinks}><a className={styles.email} href="mailto:contact@hactazia.fr">contact@hactazia.fr <span>↗</span></a><a href="https://discord.com/users/hactazia">Discord / hactazia ↗</a></div></section>
    <footer className={styles.footer}><span>© 2026 Hactazia</span><span>VR · Web · Creative Technology</span></footer>
  </main>;
}