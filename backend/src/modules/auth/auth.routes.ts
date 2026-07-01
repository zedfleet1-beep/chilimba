/**
 * Auth routes. /api/v1/auth/*
 * No business logic here — all in auth.service.ts.
 */
import { Router } from 'express';
import { authRateLimit } from '@/middleware/rateLimit';
import { requireAuth } from '@/middleware/requireAuth';
import { ah, parseBody } from '@/lib/routeHelpers';
import {
  signup,
  requestOtp,
  verifyOtpAndIssueTokens,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  requestActivationOtp,
  completeActivation,
  me,
} from './auth.service';
import {
  signupSchema,
  requestOtpSchema,
  verifyOtpSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotSchema,
  resetSchema,
  activateRequestSchema,
  activateCompleteSchema,
} from './auth.validators';

const router = Router();

router.post(
  '/signup',
  authRateLimit,
  ah(async (req, res) => {
    const input = parseBody(signupSchema, req.body);
    const result = await signup(input);
    res.status(201).json({ success: true, data: result });
  }),
);

router.post(
  '/otp/request',
  authRateLimit,
  ah(async (req, res) => {
    const input = parseBody(requestOtpSchema, req.body);
    const result = await requestOtp(input.phone);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/otp/verify',
  authRateLimit,
  ah(async (req, res) => {
    const input = parseBody(verifyOtpSchema, req.body);
    const result = await verifyOtpAndIssueTokens(input);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/login',
  authRateLimit,
  ah(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const result = await login(input);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/refresh',
  ah(async (req, res) => {
    const input = parseBody(refreshSchema, req.body);
    const result = await refresh(input.refreshToken);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/logout',
  ah(async (req, res) => {
    const input = parseBody(logoutSchema, req.body);
    const result = await logout(input.refreshToken);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/activate/request',
  authRateLimit,
  ah(async (req, res) => {
    const input = parseBody(activateRequestSchema, req.body);
    const result = await requestActivationOtp(input.phone);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/activate/complete',
  authRateLimit,
  ah(async (req, res) => {
    const input = parseBody(activateCompleteSchema, req.body);
    const result = await completeActivation(input);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/forgot',
  authRateLimit,
  ah(async (req, res) => {
    const input = parseBody(forgotSchema, req.body);
    const result = await forgotPassword(input);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/reset',
  authRateLimit,
  ah(async (req, res) => {
    const input = parseBody(resetSchema, req.body);
    const result = await resetPassword(input);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const result = await me(req.user!.id);
    res.json({ success: true, data: result });
  }),
);

export default router;
