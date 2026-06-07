import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import driversRouter from "./drivers";
import vehiclesRouter from "./vehicles";
import tripsRouter from "./trips";
import bookingsRouter from "./bookings";
import paymentsRouter from "./payments";
import ratingsRouter from "./ratings";
import supportRouter from "./support";
import statsRouter from "./stats";
import matchRouter from "./match";
import adminLogsRouter from "./admin-logs";

const router: IRouter = Router();

// Public routes — no auth required
router.use(healthRouter);
router.use(authRouter);

// Authenticated routes — valid JWT required
router.use(requireAuth);

// Mixed-role routes (passenger + driver + admin can access)
router.use(tripsRouter);
router.use(bookingsRouter);
router.use(paymentsRouter);
router.use(ratingsRouter);
router.use(vehiclesRouter);
router.use(driversRouter);   // GET list/profile + PATCH own profile; /verify guarded inline
router.use(matchRouter);     // POST /match — passengers search rides

// Admin-only routes
router.use(requireRole("admin"), usersRouter);
router.use(requireRole("admin"), statsRouter);
router.use(requireRole("admin"), adminLogsRouter);
router.use(requireRole("admin"), supportRouter);

export default router;
