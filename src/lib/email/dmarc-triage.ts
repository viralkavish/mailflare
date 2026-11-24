// Modified for VDesai Mail (https://github.com/viralkavish/mailflare) on 2026-11-23 under GNU AGPL-3.0
import type { AttachmentContent } from "@/lib/email/attachment-types";

const decoder = new TextDecoder("utf-8", { fatal: false });

async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) {
			total += value.byteLength;
			if (total > 5 * 1024 * 1024) break;
			chunks.push(value);
		}
	}
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return decoder.decode(merged);
}

async function extractSingleZipEntryXml(bytes: Uint8Array): Promise<string | null> {
	if (bytes.byteLength < 30) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (view.getUint32(0, true) !== 0x04034b50) return null;
	const method = view.getUint16(8, true);
	let compressedSize = view.getUint32(18, true);
	const fileNameLen = view.getUint16(26, true);
	const extraLen = view.getUint16(28, true);
	const dataStart = 30 + fileNameLen + extraLen;
	if (dataStart >= bytes.byteLength) return null;
	if (compressedSize === 0) {
		for (let i = bytes.byteLength - 46; i >= dataStart; i--) {
			if (view.getUint32(i, true) === 0x02014b50) {
				compressedSize = view.getUint32(i + 20, true);
				break;
			}
		}
	}
	const sliceEnd = compressedSize > 0 ? Math.min(bytes.byteLength, dataStart + compressedSize) : bytes.byteLength;
	const payload = bytes.subarray(dataStart, sliceEnd);
	if (method === 0) return decoder.decode(payload);
	if (method === 8) {
		const ds = new DecompressionStream("deflate-raw");
		const input = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(payload);
				controller.close();
			},
		});
		return readStreamText(input.pipeThrough(ds));
	}
	return null;
}

async function extractXmlFromAttachment(att: AttachmentContent): Promise<string | null> {
	const name = (att.filename || "").toLowerCase();
	const type = (att.type || "").toLowerCase();
	const bytes = new Uint8Array(att.content);
	if (bytes.byteLength === 0) return null;

	try {
		if ((bytes[0] === 0x1f && bytes[1] === 0x8b) || name.endsWith(".gz") || type.includes("gzip")) {
			const ds = new DecompressionStream("gzip");
			const input = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(bytes);
					controller.close();
				},
			});
			return await readStreamText(input.pipeThrough(ds));
		}
		if ((bytes[0] === 0x50 && bytes[1] === 0x4b) || name.endsWith(".zip") || type.includes("zip")) {
			return await extractSingleZipEntryXml(bytes);
		}
		if (name.endsWith(".xml") || type.includes("xml")) {
			return decoder.decode(bytes);
		}
	} catch {
		return null;
	}
	return null;
}

export async function evaluateDmarcReportAttachments(attachments: AttachmentContent[]): Promise<{
	isDmarcReport: boolean;
	cleanPass: boolean;
	failedCount: number;
}> {
	let sawRecord = false;
	let failedCount = 0;

	for (const att of attachments) {
		const xml = await extractXmlFromAttachment(att);
		if (!xml || !xml.includes("<feedback") || !xml.includes("<policy_evaluated>")) continue;

		const records = xml.match(/<record[\s\S]*?<\/record>/gi) ?? [];
		for (const rec of records) {
			sawRecord = true;
			const countMatch = rec.match(/<count>\s*(\d+)\s*<\/count>/i);
			const count = countMatch ? Number.parseInt(countMatch[1], 10) || 1 : 1;
			const evalBlock = rec.match(/<policy_evaluated>([\s\S]*?)<\/policy_evaluated>/i)?.[1] ?? "";
			const dkim = evalBlock.match(/<dkim>\s*([^<\s]+)\s*<\/dkim>/i)?.[1]?.toLowerCase() ?? "";
			const spf = evalBlock.match(/<spf>\s*([^<\s]+)\s*<\/spf>/i)?.[1]?.toLowerCase() ?? "";
			const disposition = evalBlock.match(/<disposition>\s*([^<\s]+)\s*<\/disposition>/i)?.[1]?.toLowerCase() ?? "none";

			const alignedPass = dkim === "pass" || spf === "pass";
			if (!alignedPass || disposition === "quarantine" || disposition === "reject") {
				failedCount += count;
			}
		}
	}

	return {
		isDmarcReport: sawRecord,
		cleanPass: sawRecord && failedCount === 0,
		failedCount,
	};
}
