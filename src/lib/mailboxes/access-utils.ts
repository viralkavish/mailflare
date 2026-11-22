/*
 * Modified by Viral Patel on 2026-11-20 under GNU AGPL-3.0 Section 5(a):
 * Enabled shared mailbox access & notification fan-out for self-hosted AGPL fork
 * (https://github.com/viralkavish/mailflare).
 */
import type { AppDatabase } from "@/db";

export async function isTeamMailboxSharingEnabled(db: AppDatabase): Promise<boolean> {
	void db;
	return true;
}
