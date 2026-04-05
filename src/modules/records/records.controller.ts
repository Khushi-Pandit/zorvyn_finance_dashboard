import { Response } from 'express';
import { recordsService } from './records.service';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/utils';

function ctx(req: AuthRequest) {
  return {
    actorId:   req.user!.sub,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

export const recordsController = {
  async list(req: AuthRequest, res: Response) {
    const result = await recordsService.list(req.query as any);
    sendPaginated(res, result);
  },

  async getById(req: AuthRequest, res: Response) {
    const record = await recordsService.getById(req.params.id);
    sendSuccess(res, { record });
  },

  async create(req: AuthRequest, res: Response) {
    const record = await recordsService.create(req.body, ctx(req));
    sendSuccess(res, { record }, 201);
  },

  async update(req: AuthRequest, res: Response) {
    const record = await recordsService.update(req.params.id, req.body, ctx(req));
    sendSuccess(res, { record });
  },

  async softDelete(req: AuthRequest, res: Response) {
    await recordsService.softDelete(req.params.id, ctx(req));
    res.status(204).send();
  },

  async restore(req: AuthRequest, res: Response) {
    const record = await recordsService.restore(req.params.id, ctx(req));
    sendSuccess(res, { record });
  },

  async export(req: AuthRequest, res: Response) {
    const result = await recordsService.export(req.query as any);
    if (result.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="records-${Date.now()}.csv"`);
      res.status(200).send(result.content);
      return;
    }
    sendSuccess(res, { records: result.content, count: result.count });
  },
};