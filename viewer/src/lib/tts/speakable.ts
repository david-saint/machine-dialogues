// Turn transcript markdown into text that reads naturally when spoken:
// strip formatting markers the voice would otherwise narrate ("asterisk
// asterisk", table pipes, heading hashes) while keeping every word.
export const toSpeakableText = (markdown: string): string => {
  let text = markdown;

  // Fenced code blocks: keep the content, drop the fence lines.
  text = text.replace(/^```[^\n]*$/gm, '');

  // Tables: drop separator rows, read each row's cells as a sentence.
  text = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (/^\|?[\s:|-]+$/.test(trimmed) && trimmed.includes('-') && trimmed.includes('|')) {
        return '';
      }
      if (trimmed.startsWith('|')) {
        const cells = trimmed
          .split('|')
          .map((cell) => cell.trim())
          .filter(Boolean);
        return cells.length > 0 ? `${cells.join(', ')}.` : '';
      }
      return line;
    })
    .join('\n');

  // Headings, blockquotes, list markers, horizontal rules.
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/^(\s*)[-*+]\s+/gm, '$1');
  text = text.replace(/^(\s*)\d+[.)]\s+/gm, '$1');
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Images and links: keep the label, drop the URL.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Emphasis, strikethrough, and inline-code markers.
  text = text.replace(/(\*\*\*|\*\*|\*|___|__|_|~~|`)/g, '');

  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
};

// Gemini TTS has a small input window and synthesizes a whole request before
// returning, so long debate turns must be split into chunks that are safe to
// send and quick enough that playback starts promptly. Chunks are also kept
// short because delivery drifts (breathy, over-dramatic) as a single
// synthesis runs long.
const MAX_CHUNK_CHARS = 1400;

export const chunkSpeakableText = (text: string, maxChars = MAX_CHUNK_CHARS): string[] => {
  // First break oversized paragraphs down to pieces that fit on their own.
  const pieces: string[] = [];
  for (const paragraph of text.split(/\n\n+/)) {
    if (paragraph.length <= maxChars) {
      pieces.push(paragraph);
      continue;
    }
    let current = '';
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      if (sentence.length > maxChars) {
        if (current) {
          pieces.push(current);
          current = '';
        }
        for (let i = 0; i < sentence.length; i += maxChars) {
          pieces.push(sentence.slice(i, i + maxChars));
        }
        continue;
      }
      if (current && current.length + sentence.length + 1 > maxChars) {
        pieces.push(current);
        current = '';
      }
      current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) {
      pieces.push(current);
    }
  }

  // Then pack pieces back together up to the chunk budget.
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > maxChars) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current.trim()) {
    chunks.push(current);
  }

  return chunks;
};
