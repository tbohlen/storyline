import pino from 'pino';
import fs from 'fs';
import path from 'path';

export interface LogData {
  timestamp: string | Date;
  agentName: string;
  interactionType: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface FormattedLogData {
  timestamp: string;
  agentName: string;
  interactionType: string;
  content: string;
  metadata?: Record<string, any>;
}

// Configure pino to write to agent_logs.jsonl file
const loggerOptions = {
  level: 'info',
  transport: {
    target: 'pino/file',
    options: {
      destination: path.join(process.cwd(), 'agent_logs.jsonl'),
      mkdir: true
    }
  }
};

const fileLogger = pino(loggerOptions);
const consoleLogger = pino();

export function logInteraction(logData: LogData): FormattedLogData {
  // Validate required fields
  const requiredFields: (keyof LogData)[] = ['timestamp', 'agentName', 'interactionType', 'content'];
  for (const field of requiredFields) {
    if (!logData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Ensure timestamp is in ISO format
  const formattedLogData: FormattedLogData = {
    ...logData,
    timestamp: logData.timestamp instanceof Date
      ? logData.timestamp.toISOString()
      : logData.timestamp
  };

  // Write to both file and console
  fileLogger.info(formattedLogData);
  consoleLogger.info(`Agent Log [${formattedLogData.agentName}]: ${formattedLogData.interactionType}`);

  return formattedLogData;
}

export function logPrompt(agentName: string, prompt: string, metadata: Record<string, any> = {}): FormattedLogData {
  return logInteraction({
    timestamp: new Date().toISOString(),
    agentName,
    interactionType: 'prompt',
    content: prompt,
    metadata
  });
}

export function logResponse(agentName: string, response: any, metadata: Record<string, any> = {}): FormattedLogData {
  // Convert response object to string if needed
  const content = typeof response === 'object'
    ? JSON.stringify(response, null, 2)
    : String(response);

  return logInteraction({
    timestamp: new Date().toISOString(),
    agentName,
    interactionType: 'response',
    content,
    metadata
  });
}

export async function getLogHistory(): Promise<FormattedLogData[]> {
  try {
    const logFilePath = path.join(process.cwd(), 'agent_logs.jsonl');

    // Check if file exists
    if (!fs.existsSync(logFilePath)) {
      return [];
    }

    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const logLines = logContent.trim().split('\n').filter(line => line.trim());

    const logs = logLines.map(line => {
      try {
        return JSON.parse(line) as FormattedLogData;
      } catch (error) {
        consoleLogger.warn({ line, error: error instanceof Error ? error.message : String(error) }, 'Failed to parse log line:');
        return null;
      }
    }).filter((log): log is FormattedLogData => log !== null);

    return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  } catch (error) {
    consoleLogger.error({ error }, 'Failed to read log history:');
    throw error;
  }
}

export async function clearLogs(): Promise<void> {
  try {
    const logFilePath = path.join(process.cwd(), 'agent_logs.jsonl');
    if (fs.existsSync(logFilePath)) {
      fs.writeFileSync(logFilePath, '');
      consoleLogger.info('Agent logs cleared');
    }
  } catch (error) {
    consoleLogger.error({ error }, 'Failed to clear logs:');
    throw error;
  }
}