import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"shopify cache reconciliation",
	{ minutes: 30 },
	internal.shopifySync.reconcileAllShops,
	{},
);

export default crons;
