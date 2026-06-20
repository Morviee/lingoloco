import React from 'react';
import styles from './TopNav.module.css';
import Link from 'next/link';

export default function TopNav() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/">
          LingoLoco
        </Link>
      </div>

      <div className={styles.centerLinks}>
        <Link href="/">Home</Link>
        <Link href="/learn">Learn</Link>
        <Link href="/compete">Compete</Link>
        <Link href="/chat">Chat</Link>
        <Link href="/dashboard/es">Dashboard</Link>
      </div>
      
      <div className={styles.rightLinks}>
        <Link href="/login" className={styles.textLink}>Login</Link>
        <Link href="/signup" className={styles.textLink}>Sign up</Link>
        <Link href="/start" className={styles.ctaButton}>Get Started</Link>
      </div>
    </nav>
  );
}
