// Modified for VDesai Mail (https://github.com/viralkavish/mailflare) on 2026-11-23 under GNU AGPL-3.0
import { getServerTranslator } from "@/lib/i18n/server";
import { BrowserNotificationSettings } from "@/components/settings/browser-notification-settings";
import { PushNotificationSettings } from "@/components/settings/push-notification-settings";

export default async function SettingsNotificationsPage() {
	const t = await getServerTranslator();
	return (
		<div className="space-y-8 py-4">
			<section className="space-y-4">
				<div>
					<h1 className="text-xl font-semibold text-neutral-900">{t("settingsPage.inbox.notifications")}</h1>
					<p className="mt-1 text-sm text-neutral-500">{t("settingsPage.inbox.notificationsDescription")}</p>
				</div>
				<div className="space-y-4 rounded-3xl bg-white p-6">
					<PushNotificationSettings />
					<BrowserNotificationSettings />
				</div>
			</section>
		</div>
	);
}
