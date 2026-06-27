/**
 * Loan routes. /api/v1/groups/:id/loans/*
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireGroupRole } from '@/middleware/requireGroupRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import { requestLoanSchema, rejectLoanSchema, recordRepaymentSchema } from './loans.validators';
import {
  listLoans,
  requestLoan,
  approveLoan,
  rejectLoan,
  recordRepayment,
  getMyLoanEligibility,
} from './loans.service';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get(
  '/',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const loans = await listLoans(req.params.id);
    res.json({ success: true, data: loans });
  }),
);

router.get(
  '/eligibility',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const eligibility = await getMyLoanEligibility(req.params.id, {
      memberId: req.groupMembership!.memberId,
    });
    res.json({ success: true, data: eligibility });
  }),
);

router.post(
  '/',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const input = parseBody(requestLoanSchema, req.body);
    const loan = await requestLoan(
      req.params.id,
      {
        memberId: req.groupMembership!.memberId,
        userId: req.user!.id,
        role: req.groupMembership!.role,
      },
      input,
    );
    res.status(201).json({ success: true, data: loan });
  }),
);

router.post(
  '/:loanId/approve',
  requireGroupRole('owner', 'treasurer'),
  ah(async (req, res) => {
    const loan = await approveLoan(req.params.id, req.params.loanId, {
      id: req.user!.id,
      role: req.groupMembership!.role,
    });
    res.json({ success: true, data: loan });
  }),
);

router.post(
  '/:loanId/reject',
  requireGroupRole('owner', 'treasurer'),
  ah(async (req, res) => {
    const input = parseBody(rejectLoanSchema, req.body ?? {});
    const loan = await rejectLoan(req.params.id, req.params.loanId, {
      id: req.user!.id,
      role: req.groupMembership!.role,
    }, input.reason);
    res.json({ success: true, data: loan });
  }),
);

router.post(
  '/:loanId/repayments',
  requireGroupRole('owner', 'treasurer'),
  ah(async (req, res) => {
    const input = parseBody(recordRepaymentSchema, req.body);
    const loan = await recordRepayment(req.params.id, req.params.loanId, {
      id: req.user!.id,
      role: req.groupMembership!.role,
    }, input);
    res.json({ success: true, data: loan });
  }),
);

export default router;