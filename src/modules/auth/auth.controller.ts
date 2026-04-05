import { Request, Response } from 'express';
import { authService } from './auth.service';
import { AuthRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils';
import { UnauthorizedError } from '../../shared/errors';
import { config } from '../../config';

const COOKIE_NAME = 'refreshToken';

const cookieOptions = {
  httpOnly: true,
  secure:   config.env === 'production',
  sameSite: 'strict' as const,
  maxAge:   config.jwt.refreshTtlDays * 86400 * 1000,
  path:     '/api/v1/auth',
};

function getContext(req: Request) {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

export const authController = {
  async register(req: Request, res: Response) {
    const user = await authService.register(req.body, getContext(req));
    sendSuccess(res, { user }, 201);
  },

  async login(req: Request, res: Response) {
    const { user, accessToken, refreshToken } = await authService.login(req.body, getContext(req));
    res.cookie(COOKIE_NAME, refreshToken, cookieOptions);
    sendSuccess(res, { user, accessToken });
  },

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    if (!token) throw new UnauthorizedError('No refresh token provided');

    const { accessToken, refreshToken } = await authService.refresh(token, getContext(req));
    res.cookie(COOKIE_NAME, refreshToken, cookieOptions);
    sendSuccess(res, { accessToken });
  },

  async logout(req: AuthRequest, res: Response) {
    const token = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    if (token && req.user) {
      await authService.logout(token, req.user.sub, getContext(req));
    }
    res.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
    res.status(204).send();
  },

  async me(req: AuthRequest, res: Response) {
    const user = await authService.getMe(req.user!.sub);
    sendSuccess(res, { user });
  },

  async changePassword(req: AuthRequest, res: Response) {
    await authService.changePassword(req.user!.sub, req.body, getContext(req));
    res.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
    sendSuccess(res, { message: 'Password changed successfully. Please log in again.' });
  },
};