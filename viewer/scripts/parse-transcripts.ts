import fs from 'fs';
import path from 'path';
import { parseTranscript } from '../src/lib/parser';
import { MOCK_EVALUATION } from '../src/data/mock-evaluation';

const TRANSCRIPTS_DIR = path.resolve('../transcripts');
const OUTPUT_FILE = path.resolve('./src/data/transcripts.json');

async function main() {
  const files = fs.readdirSync(TRANSCRIPTS_DIR).filter(f => f.endsWith('.md'));
  const transcripts = [];

  for (const file of files) {
    console.log(`Parsing ${file}...`);
    const content = fs.readFileSync(path.join(TRANSCRIPTS_DIR, file), 'utf-8');
    const id = file.replace('.md', '');
    try {
      const transcript = parseTranscript(content, id);
      
      // Inject mock evaluation for demonstration
      if (id === '20260314_140820_gemini-3.1-pro_vs_claude-opus-4.6') {
        transcript.evaluation = MOCK_EVALUATION;
      }
      
      transcripts.push(transcript);
    } catch (e) {
      console.error(`Error parsing ${file}:`, e);
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(transcripts, null, 2));
  console.log(`Wrote ${transcripts.length} transcripts to ${OUTPUT_FILE}`);
}

main().catch(console.error);
