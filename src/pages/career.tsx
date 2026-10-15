import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import { roles, type Role } from "../data/careerRoles";
import styles from "./career.module.css";

// Same key and id format as the original static page, so saved progress carries over.
const DONE_KEY = "careerSkillMatrixDone";
const courseId = (roleId: string, index: number) => `${roleId}__${index}`;

function readDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function writeDone(done: Set<string>) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    // Storage unavailable (private mode); progress lasts for this visit only.
  }
}

function List({ items }: { items: string[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RoleTabs({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + roles.length) % roles.length;
    onSelect(roles[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label="Target role" className={styles.tabs}>
      {roles.map((role, i) => {
        const selected = role.id === activeId;
        return (
          <button
            key={role.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${role.id}`}
            aria-selected={selected}
            aria-controls={`panel-${role.id}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onSelect(role.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {role.name}
          </button>
        );
      })}
    </div>
  );
}

function Courses({ role, done, onToggle }: { role: Role; done: Set<string>; onToggle: (id: string) => void }) {
  if (role.courses.length === 0) {
    return <p className={styles.muted}>No courses listed for this role yet.</p>;
  }
  return (
    <ul className={styles.courses}>
      {role.courses.map((course, i) => {
        const id = courseId(role.id, i);
        const checked = done.has(id);
        return (
          <li key={id} className={checked ? styles.courseDone : undefined}>
            <label className={styles.courseLabel}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(id)} />
              <span className={styles.courseName}>{course.name}</span>
            </label>
            <span className={styles.courseMeta}>
              {course.platform},{" "}
              <a href={course.url} target="_blank" rel="noopener noreferrer">
                view course
              </a>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RolePanel({ role, done, onToggle }: { role: Role; done: Set<string>; onToggle: (id: string) => void }) {
  return (
    <section id={`panel-${role.id}`} role="tabpanel" aria-labelledby={`tab-${role.id}`} className={styles.panel}>
      <Heading as="h2" className={styles.roleName}>
        {role.name}
      </Heading>
      <p className={styles.focus}>{role.focus}</p>

      <div className={styles.block}>
        <Heading as="h3" className={styles.blockTitle}>
          Core technical skills
        </Heading>
        <div className={styles.columns}>
          <div>
            <Heading as="h4" className={styles.level}>
              Essential
            </Heading>
            <List items={role.core} />
          </div>
          <div>
            <Heading as="h4" className={styles.level}>
              Advanced
            </Heading>
            <List items={role.advanced} />
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.block}>
          <Heading as="h3" className={styles.blockTitle}>
            Domain knowledge
          </Heading>
          <List items={role.domain} />
        </div>
        <div className={styles.block}>
          <Heading as="h3" className={styles.blockTitle}>
            Tools and technologies
          </Heading>
          <List items={role.tools} />
        </div>
        <div className={styles.block}>
          <Heading as="h3" className={styles.blockTitle}>
            Soft skills
          </Heading>
          <List items={role.soft} />
        </div>
        <div className={styles.block}>
          <Heading as="h3" className={styles.blockTitle}>
            Certifications and qualifications
          </Heading>
          <List items={role.certs} />
        </div>
      </div>

      <div className={styles.block}>
        <Heading as="h3" className={styles.blockTitle}>
          Roadmap
        </Heading>
        <ol className={styles.roadmap}>
          {role.roadmap.map((phase) => (
            <li key={phase.span}>
              <span className={styles.span}>{phase.span}</span>
              <strong className={styles.goal}>{phase.goal}</strong>
              <p className={styles.action}>{phase.action}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.block}>
        <Heading as="h3" className={styles.blockTitle}>
          Recommended courses
        </Heading>
        <p className={styles.muted}>Check one off when you finish it. Progress is saved in this browser.</p>
        <Courses role={role} done={done} onToggle={onToggle} />
      </div>
    </section>
  );
}

export default function Career(): ReactNode {
  const [activeId, setActiveId] = useState(roles[0].id);
  const [done, setDone] = useState<Set<string>>(() => new Set());

  useEffect(() => setDone(readDone()), []);

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeDone(next);
      return next;
    });
  }

  const role = roles.find((r) => r.id === activeId) ?? roles[0];

  return (
    <Layout
      title="Career skill matrix"
      description="Skill matrix and learning roadmap for moving into Forward Deployed Engineer, Principal Architect, Software Architect, Staff Engineer, or Technical Program Manager roles."
    >
      <main className={styles.page}>
        <header className={styles.intro}>
          <Heading as="h1" className={styles.title}>
            Career progression skill matrix
          </Heading>
          <p className={styles.lede}>
            Pick one destination role, then use its roadmap to choose stretch work in your current position.
            Certifications help with credibility; shipped outcomes, sound judgment and a record of influence
            matter more.
          </p>
        </header>

        <RoleTabs activeId={role.id} onSelect={setActiveId} />
        <RolePanel role={role} done={done} onToggle={toggle} />

        <p className={styles.closing}>
          Build proof, not just knowledge. Keep sanitized designs, plans, measurable outcomes and leadership
          stories as evidence of readiness.
        </p>
      </main>
    </Layout>
  );
}
