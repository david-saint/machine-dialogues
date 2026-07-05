import fs from 'fs';
import path from 'path';
import type { Judgment, JudgmentsByTranscript } from '../src/types/judgment';

// Judgments live at judgments/<transcript_basename>/<judge_slug>.json.
// This globs one directory deep, so judgments/schema.json is naturally excluded.
const JUDGMENTS_DIR = path.resolve('../judgments');
const OUTPUT_FILE = path.resolve('./src/data/judgments.json');

function collectJudgmentFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue; // skip top-level files like schema.json
    const subdir = path.join(dir, entry.name);
    for (const file of fs.readdirSync(subdir)) {
      if (file.endsWith('.json')) {
        files.push(path.join(subdir, file));
      }
    }
  }

  return files.sort();
}

async function main() {
  const files = collectJudgmentFiles(JUDGMENTS_DIR);
  const byTranscript: JudgmentsByTranscript = {};

  for (const file of files) {
    const rel = path.relative(JUDGMENTS_DIR, file);
    console.log(`Parsing judgment ${rel}...`);
    try {
      const judgment = JSON.parse(fs.readFileSync(file, 'utf-8')) as Judgment;
      const key = judgment.transcript;
      if (!key) {
        console.error(`Skipping ${rel}: missing "transcript" field`);
        continue;
      }
      (byTranscript[key] ||= []).push(judgment);
    } catch (e) {
      console.error(`Error parsing ${rel}:`, e);
    }
  }

  // Deterministic ordering of judges within each transcript (by judge name).
  for (const key of Object.keys(byTranscript)) {
    byTranscript[key].sort((a, b) => a.judge.name.localeCompare(b.judge.name));
  }

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(byTranscript, null, 2));

  const transcriptCount = Object.keys(byTranscript).length;
  const judgmentCount = files.length;
  console.log(
    `Wrote ${judgmentCount} judgment(s) across ${transcriptCount} transcript(s) to ${OUTPUT_FILE}`
  );
}

main().catch(console.error);
