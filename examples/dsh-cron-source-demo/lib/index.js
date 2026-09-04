/**
 * dsh-cron-source-demo — the smallest possible cron job provider.
 *
 * Copy this package when a piece of software should ship its own schedule:
 * the jobs exist because the package is installed, and retire when it is
 * removed, instead of being transcribed into a dialog on every host. See the
 * "Adding jobs from a plugin" section of dsh-cron's README.
 * @module dsh-cron-source-demo
 */
import z from "@deepseek-ai/schemastery";

export const name = "cron-source-demo";

/** The only dependency: dsh-cron's registration facade. */
export const inject = ["cron"];

/** Owner identity shown in the overlay; the package name is the honest choice. */
export const OWNER = "dsh-cron-source-demo";

export const Config = z.object({
	/** What the demo job echoes; kept configurable to show config-derived specs. */
	message: z.string().default("dsh-cron plugin-mode demo"),
});

/** The specs this provider brings. Pure, so a test can assert them without cordis. */
export function buildSpecs(config) {
	return [
		{
			name: "demo-heartbeat",
			description: "Example job registered by a provider plugin",
			schedule: { everySeconds: 3600 },
			task: { kind: "command", argv: ["/bin/echo", config.message], timeoutSeconds: 30 },
			policy: { overlap: "skip", misfire: "skip" },
		},
	];
}

export function apply(ctx, config) {
	// Registration lives in an effect so unmounting the provider (or reloading
	// its config) retires exactly the jobs it brought — nothing else.
	ctx.effect(() => {
		const dispose = ctx.cron.registerJobs(buildSpecs(config), { owner: OWNER });
		ctx.logger.info(`${OWNER}: registered demo-heartbeat`);
		return dispose;
	}, "demo.cron()");
}
