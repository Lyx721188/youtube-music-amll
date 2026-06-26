// AMLL for YouTube Music - background service worker
// 负责跨域获取 TTML 歌词、字体文件（绕过页面 CSP）与缓存

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg?.type === "amll:fetch-ttml") {
		fetchTtml(msg.url)
			.then((text) => sendResponse({ ok: true, text }))
			.catch((err) => sendResponse({ ok: false, error: String(err) }));
		return true;
	}
	if (msg?.type === "amll:fetch-json") {
		fetchJson(msg.url, msg.method, msg.body, msg.contentType, msg.headers)
			.then((json) => sendResponse({ ok: true, json }))
			.catch((err) => sendResponse({ ok: false, error: String(err) }));
		return true;
	}
	if (msg?.type === "amll:fetch-data-url") {
		fetchDataUrl(msg.url)
			.then((dataUrl) => sendResponse({ ok: true, dataUrl }))
			.catch((err) => sendResponse({ ok: false, error: String(err) }));
		return true;
	}
	if (msg?.type === "amll:fetch-text") {
		fetchText(msg.url, msg.method, msg.body, msg.contentType, msg.headers)
			.then((text) => sendResponse({ ok: true, text }))
			.catch((err) => sendResponse({ ok: false, error: String(err) }));
		return true;
	}
});

async function fetchTtml(url: string) {
	const res = await fetch(url, { credentials: "omit" });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.text();
}

async function fetchJson(url: string, method?: string, body?: string, contentType?: string, extraHeaders?: Record<string, string>) {
	const opts: RequestInit = { credentials: "omit" };
	if (method) opts.method = method;
	if (body) {
		opts.body = body;
		opts.headers = { "Content-Type": contentType || "application/x-www-form-urlencoded" };
	}
	if (extraHeaders) {
		opts.headers = { ...(opts.headers || {}), ...extraHeaders };
	}
	const res = await fetch(url, opts);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

async function fetchText(url: string, method?: string, body?: string, contentType?: string, extraHeaders?: Record<string, string>) {
	const opts: RequestInit = { credentials: "omit" };
	if (method) opts.method = method;
	if (body) {
		opts.body = body;
		opts.headers = { "Content-Type": contentType || "application/x-www-form-urlencoded" };
	}
	if (extraHeaders) {
		opts.headers = { ...(opts.headers || {}), ...extraHeaders };
	}
	const res = await fetch(url, opts);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.text();
}

async function fetchDataUrl(url: string) {
	const res = await fetch(url, { credentials: "omit" });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const buf = await res.arrayBuffer();
	const bytes = new Uint8Array(buf);
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return `data:font/woff2;base64,${btoa(binary)}`;
}
