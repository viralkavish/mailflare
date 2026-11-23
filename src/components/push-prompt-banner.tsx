// Modified for VDesai Mail (https://github.com/viralkavish/mailflare) on 2026-11-23 under GNU AGPL-3.0
"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/client";
import { enablePushNotifications, getPushState } from "@/lib/push/client";
import toast from "react-hot-toast";

const DISMISS_KEY = "vdesai_push_prompt_dismissed_v1";

export function PushPromptBanner() {
	const [visible, setVisible] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		try {
			if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
		} catch {
			// Ignore storage failures in restricted contexts.
		}

		void getPushState()
			.then((state) => {
				if (cancelled) return;
				if (state.supported && state.configured && !state.subscribed && state.permission !== "denied") {
					setVisible(true);
				}
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, []);

	if (!visible) return null;

	async function handleEnable() {
		setBusy(true);
		try {
			await enablePushNotifications();
			await authFetch("/api/push/config", {
				method: "POST",
				redirectOnUnauthorized: false,
			}).catch(() => null);
			setVisible(false);
			toast.success("Notifications enabled on this device");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not enable notifications");
		} finally {
			setBusy(false);
		}
	}

	function handleDismiss() {
		try {
			window.localStorage.setItem(DISMISS_KEY, "1");
		} catch {
			// Ignore storage write errors.
		}
		setVisible(false);
	}

	return (
		<div
			role="status"
			className="mx-2 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-950"
		>
			<BellRing className="h-4 w-4 shrink-0 text-blue-700" />
			<p className="min-w-0 flex-1">
				Enable push notifications on this device to get instant alerts when new emails arrive.
			</p>
			<div className="flex items-center gap-2">
				<Button type="button" size="sm" disabled={busy} onClick={() => void handleEnable()}>
					{busy ? "Enabling..." : "Enable notifications"}
				</Button>
				<button
					type="button"
					onClick={handleDismiss}
					aria-label="Dismiss notification prompt"
					className="rounded-lg p-1 text-blue-700 hover:bg-blue-100"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
