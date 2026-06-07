import { Router, type IRouter } from "express";
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

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(driversRouter);
router.use(vehiclesRouter);
router.use(tripsRouter);
router.use(bookingsRouter);
router.use(paymentsRouter);
router.use(ratingsRouter);
router.use(supportRouter);
router.use(statsRouter);
router.use(matchRouter);
router.use(adminLogsRouter);

export default router;
