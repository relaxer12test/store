import agent from "@convex-dev/agent/convex.config";
import r2 from "@convex-dev/r2/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();

app.use(agent);
app.use(betterAuth);
app.use(rateLimiter);
app.use(r2);

export default app;
