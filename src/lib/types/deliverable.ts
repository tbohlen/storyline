/**
 * TypeScript interfaces for deliverable data structures
 */

export interface Deliverable {
  title: string;
  content: string; // Markdown content
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
}