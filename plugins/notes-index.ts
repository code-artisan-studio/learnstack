import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { LoadContext, Plugin } from "@docusaurus/types";

import { topics, type Topic } from "../src/data/topics";

// A note shorter than this is a placeholder outline, not written content.
const OUTLINE_WORD_LIMIT = 150;

export type TopicStats = Topic & {
  notes: number;
  outlines: number;
  words: number;
  updated: string | null;
};

export type NotesIndex = {
  topics: TopicStats[];
  totalNotes: number;
  updated: string | null;
};

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return /\.mdx?$/.test(entry.name) ? [full] : [];
  });
}

function wordCount(file: string): number {
  const body = readFileSync(file, "utf8").replace(/^---[\s\S]*?---/, "");
  return body.split(/\s+/).filter(Boolean).length;
}

// Last commit touching the paths; falls back to file mtime when git history is
// unavailable (e.g. a shallow CI clone).
function lastUpdated(paths: string[], files: string[]): string | null {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...paths], {
      encoding: "utf8",
    }).trim();
    if (out) return out;
  } catch {
    // fall through to mtime
  }
  const newest = Math.max(0, ...files.map((f) => statSync(f).mtimeMs));
  return newest ? new Date(newest).toISOString() : null;
}

export default function notesIndexPlugin(context: LoadContext): Plugin {
  const docsRoot = path.join(context.siteDir, "docs");

  return {
    name: "notes-index",

    async loadContent(): Promise<NotesIndex> {
      const stats = topics.map((topic): TopicStats => {
        const dirs = topic.dirs.map((d) => path.join(docsRoot, d));
        const files = dirs.flatMap(markdownFiles);
        const counts = files.map(wordCount);
        return {
          ...topic,
          notes: files.length,
          outlines: counts.filter((w) => w < OUTLINE_WORD_LIMIT).length,
          words: counts.reduce((sum, w) => sum + w, 0),
          updated: lastUpdated(dirs, files),
        };
      });

      const allFiles = markdownFiles(docsRoot);
      return {
        topics: stats,
        totalNotes: allFiles.length,
        updated: lastUpdated([docsRoot], allFiles),
      };
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
}
