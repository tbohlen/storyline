import type { NextApiRequest, NextApiResponse } from 'next';

interface TestResponse {
  message: string;
  timestamp: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResponse>
) {
  if (req.method === 'GET') {
    res.status(200).json({
      message: 'Storyline API is working',
      timestamp: new Date().toISOString()
    });
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}