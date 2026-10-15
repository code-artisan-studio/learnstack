import type { CSSProperties, ReactNode } from "react";
import Link from "@docusaurus/Link";
import { usePluginData } from "@docusaurus/useGlobalData";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import type { NotesIndex, TopicStats } from "../../plugins/notes-index";
import styles from "./index.module.css";

// Dates come from the build, so format in UTC to match server and client render.
function formatDate(iso: string | null, month: "short" | "long"): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month,
    day: "numeric",
    year: month === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function rowNote(topic: TopicStats): { text: string; outline: boolean } | null {
  if (topic.outlines === topic.notes) return { text: "Outline only", outline: true };
  if (topic.outlines * 2 >= topic.notes) return { text: "Mostly outlines", outline: true };
  const updated = formatDate(topic.updated, "short");
  return updated ? { text: `Updated ${updated}`, outline: false } : null;
}

function TopicRow({ topic, maxWords, index }: { topic: TopicStats; maxWords: number; index: number }) {
  const note = rowNote(topic);
  const depth = Math.max(topic.words / maxWords, 0.01);
  return (
    <li>
      <Link to={topic.to} className={styles.row}>
        <span className={styles.rowTitle}>{topic.title}</span>
        <span className={styles.rowDescription}>{topic.description}</span>
        <span className={styles.rowDepth}>
          <span
            className={styles.stroke}
            style={{ "--depth": depth, "--delay": `${index * 60}ms` } as CSSProperties}
            aria-hidden="true"
          />
          <span className={styles.rowCount}>
            {topic.notes} {topic.notes === 1 ? "note" : "notes"}, {topic.words.toLocaleString("en-US")} words
          </span>
        </span>
        {note && (
          <span className={note.outline ? styles.rowOutline : styles.rowUpdated}>{note.text}</span>
        )}
      </Link>
    </li>
  );
}

export default function Home(): ReactNode {
  const data = usePluginData("notes-index") as NotesIndex;
  const sorted = [...data.topics].sort((a, b) => b.words - a.words);
  const maxWords = sorted[0]?.words || 1;
  const updated = formatDate(data.updated, "long");

  return (
    <Layout
      title="Engineering notes"
      description="Engineering notes across React, .NET, databases, system design, Azure, DevOps and AI, kept for interview revision."
    >
      <main className={styles.page}>
        <header className={styles.intro}>
          <Heading as="h1" className={styles.title}>
            Engineering notes, kept for interview revision.
          </Heading>
          <p className={styles.lede}>
            {data.totalNotes} notes across {sorted.length} subjects
            {updated && `, last updated ${updated}`}. The longer the highlight, the more there is to read.
          </p>
          <Link className={styles.cta} to="/docs/">
            Open the notes
          </Link>
        </header>

        <section aria-labelledby="subjects">
          <Heading as="h2" id="subjects" className={styles.sectionTitle}>
            Subjects
          </Heading>
          <ul className={styles.index}>
            {sorted.map((topic, i) => (
              <TopicRow key={topic.title} topic={topic} maxWords={maxWords} index={i} />
            ))}
          </ul>
        </section>
      </main>
    </Layout>
  );
}
