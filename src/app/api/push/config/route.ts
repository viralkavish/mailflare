// Modified for VDesai Mail (https://github.com/viralkavish/mailflare) on 2026-11-23 under GNU AGPL-3.0
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireSessionUser } from "@/lib/api/auth";
import { getVapidPublicKey, sendPushContent } from "@/lib/push/server";

export async function GET(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;

	const publicKey = getVapidPublicKey(env);
	return NextResponse.json({ enabled: !!publicKey, publicKey });
}

export async function POST(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	if (!getVapidPublicKey(env)) {
		return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });
	}

	await sendPushContent(env, [auth.user.id], {
		title: "VDesai Mail notifications active",
		body: "Instant alerts are now enabled on this device.",
		tag: `mailflare-test-${Date.now()}`,
		url: "/inbox",
		forceShow: true,
	});

	return NextResponse.json({ ok: true });
}
