import express, { Request, Response } from 'express';

const router = express.Router();

router.route('/').get((_req: Request, res: Response) => {
  res.json({ message: 'MCP Client Endpoint in the future' });
});

export default router;
