export function chunkText(text: string, chunkSize: number = 2000, overlapSize: number = 200): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    const chunk = text.substring(startIndex, endIndex);
    chunks.push(chunk);

    if (endIndex >= text.length) {
      break;
    }

    startIndex = endIndex - overlapSize;
  }

  return chunks;
}