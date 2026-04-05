import { Response } from 'express';
import { usersService } from './users.service';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/utils';

function ctx(req: AuthRequest) {
  return {
    actorId:   req.user!.sub,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

export const usersController = {
  async list(req: AuthRequest, res: Response) {
    const result = await usersService.list(req.query as any);
    sendPaginated(res, result);
  },

  async getById(req: AuthRequest, res: Response) {
    const user = await usersService.getById(req.params.id);
    sendSuccess(res, { user });
  },

  async create(req: AuthRequest, res: Response) {
    const user = await usersService.create(req.body, ctx(req));
    sendSuccess(res, { user }, 201);
  },

  async update(req: AuthRequest, res: Response) {
    const user = await usersService.update(req.params.id, req.body, ctx(req));
    sendSuccess(res, { user });
  },

  async updateRole(req: AuthRequest, res: Response) {
    const user = await usersService.updateRole(req.params.id, req.body, ctx(req));
    sendSuccess(res, { user });
  },

  async updateStatus(req: AuthRequest, res: Response) {
    const user = await usersService.updateStatus(req.params.id, req.body, ctx(req));
    sendSuccess(res, { user });
  },

  async softDelete(req: AuthRequest, res: Response) {
    await usersService.softDelete(req.params.id, ctx(req));
    res.status(204).send();
  },
};