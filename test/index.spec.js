import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

describe("Hello Webhooks worker", () => {
	it("responds with Hello Webhooks! (unit style)", async () => {
		const request = new Request("http://example.com");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello Webhooks!"`);
	});

	it("responds with Hello Webhooks! (integration style)", async () => {
		const response = await SELF.fetch("http://example.com/");
		expect(await response.text()).toMatchInlineSnapshot(`"Hello Webhooks!"`);
	});

	it("responds with Not Found for unknown paths", async () => {
		const response = await SELF.fetch("http://example.com/unknown");
		expect(await response.text()).toMatchInlineSnapshot(`"Not Found"`);
		expect(response.status).toBe(404);
	});

	it("ignores non-MR GitLab webhook events", async () => {
		const response = await SELF.fetch("http://example.com/gitlab-webhook", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ object_kind: "push" }),
		});
		expect(await response.text()).toMatchInlineSnapshot(
			`"ignored - not a merge request event"`,
		);
		expect(response.status).toBe(200);
	});
});
