import type { StorylineToolPart } from '@/lib/utils/message-helpers';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from './ai-elements/tool';

/**
 * Custom component for rendering tool invocations
 */
export default function ToolRenderer({ part }: { part: StorylineToolPart }) {
  const toolName = part.type.replace('tool-', '');

  switch (part.state) {
    case 'input-available':
      return (
        <Tool>
          <ToolHeader
            state={part.state}
            type={part.type}
            title={toolName}
            />
          <ToolContent>
            <ToolInput input={part.input} />
          </ToolContent>
        </Tool>
      );

    case 'output-available':
      return (
        <Tool>
          <ToolHeader
            state={part.state}
            type={part.type}
            title={toolName}
            />
          <ToolContent>
            <ToolInput input={part.input} />
            <ToolOutput output={part.output} errorText={part.errorText} />
          </ToolContent>
        </Tool>
      );

    case 'input-streaming':
    case 'output-error':
    default:
      break;
  }
}