import type { NextApiRequest, NextApiResponse } from 'next';
import { getLogHistory, clearLogs, FormattedLogData } from '../../lib/agentLogger';

interface LogsGetResponse {
  success: boolean;
  logs: FormattedLogData[];
  count: number;
}

interface LogsDeleteResponse {
  success: boolean;
  message: string;
}

interface LogsErrorResponse {
  success: boolean;
  error: string;
  message: string;
}

type LogsResponse = LogsGetResponse | LogsDeleteResponse | LogsErrorResponse;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogsResponse>
) {
  if (req.method === 'GET') {
    try {
      const logs = await getLogHistory();
      res.status(200).json({
        success: true,
        logs,
        count: logs.length
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve logs',
        message: errorMessage
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      await clearLogs();
      res.status(200).json({
        success: true,
        message: 'Logs cleared successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: 'Failed to clear logs',
        message: errorMessage
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}