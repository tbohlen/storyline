import { Annotation } from '@/lib/types/annotation';

/**
 * Highlights the selected annotation text with "**" markers for bold
 * Adjusts marker placement to avoid spaces that would break bold rendering
 */
export function highlightSelectedAnnotation(
  text: string,
  selectedAnnotation: Annotation | null
): string {
  if (!selectedAnnotation) {
    return text;
  }

  // Extract the text span for this annotation
  const beforeText = text.slice(0, selectedAnnotation.firstCharacter);
  const highlightedText = text.slice(selectedAnnotation.firstCharacter, selectedAnnotation.lastCharacter);
  const afterText = text.slice(selectedAnnotation.lastCharacter);

  // Trim spaces from the highlighted text and adjust placement
  const trimmedHighlightedText = highlightedText.trim();
  
  // Find where the actual content starts and ends within the highlighted text
  const startSpaces = highlightedText.match(/^\s*/)?.[0] || '';
  const endSpaces = highlightedText.match(/\s*$/)?.[0] || '';
  
  // Place the "**" markers around the trimmed content, keeping spaces outside
  return beforeText + startSpaces + '**' + trimmedHighlightedText + '**' + endSpaces + afterText;
}

/**
 * Creates annotation lookup map for easy access
 */
export function createAnnotationLookup(annotations: Annotation[]): Map<string, { annotation: Annotation; number: number }> {
  const lookup = new Map();
  annotations.forEach((annotation, index) => {
    lookup.set(annotation.id, { annotation, number: index + 1 });
  });
  return lookup;
}