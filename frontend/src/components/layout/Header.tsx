"use client";

/**
 * components/layout/Header.tsx
 * -----------------------------------------------------------------------------
 * Header ตามโครงของตี้:
 * - dropdown context selector (ตอนนี้เป็น placeholder เพื่อรองรับหลายแผน/หลาย context ในอนาคต)
 * - notification icon
 * - settings icon
 */

import styles from "./layout.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div>
        <select
          style={{
            height: 40,
            borderRadius: 12,
            border: "1px solid var(--border)",
            padding: "0 12px",
            background: "white",
          }}
          defaultValue="default"
        >
          <option value="default">บริบท: แผนการเรียนของฉัน</option>
        </select>
      </div>

      <div className={styles.headerRight}>
        <button className={styles.iconBtn} title="แจ้งเตือน" aria-label="notification">
          🔔
        </button>
        <button className={styles.iconBtn} title="ตั้งค่า" aria-label="settings">
          ⚙️
        </button>
      </div>
    </header>
  );
}
