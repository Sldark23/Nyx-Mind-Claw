import { Router, Request, Response } from 'express';

export const chatRouter = Router();

chatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { message, model, temperature } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // TODO: Connect to core agent loop
    const response = {
      content: `Echo: ${message}`,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

chatRouter.get('/models', (req: Request, res: Response) => {
  res.json({
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
  });
});

chatRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});