import { DomLyricPlayer } from "./lib/amll-core.mjs";
import type { LyricLine } from "./lib/amll-core.mjs";
import { parseLrc, parseYrc, parseQrc, parseLys } from "./lib/amll-lyric.mjs";
import type { LyricLine as RawLyricLine } from "./lib/amll-lyric.mjs";
import { parseTTML } from "./lib/amll-ttml.mjs";
import amllCoreCss from "./lib/amll-core.css";

const LOG = (...a: unknown[]) => console.log("[AMLL]", ...a);
const LOG_VERBOSE = false;

interface SongInfo {
	id: string;
	title: string;
	artist: string;
	cover: string;
}

interface StoredLyric {
	ext: string;
	content: string;
}

interface LrclibTrack {
	id?: number;
	trackName?: string;
	artistName?: string;
	albumName?: string;
	duration?: number;
	plainLyrics?: string;
	syncedLyrics?: string;
	instrumental?: boolean;
}

interface ItunesResult {
	trackId?: number;
	trackName?: string;
	artistName?: string;
	collectionName?: string;
}

interface ItunesResponse {
	resultCount?: number;
	results?: ItunesResult[];
}

interface NcmArtist {
	name?: string;
	id?: number;
}

interface NcmSong {
	id?: number;
	name?: string;
	duration?: number;
	artists?: NcmArtist[];
}

interface NcmSearchResponse {
	code?: number;
	result?: {
		songCount?: number;
		songs?: NcmSong[];
	};
}

function cleanArtistName(artist: string): string {
	if (!artist) return "";
	let cleaned = artist
		.replace(/\s*[&,×、和与/]\s*/g, " ")
		.replace(/\s+feat\.?\s+/gi, " ")
		.replace(/\s+x\s+/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
	const parts = cleaned.split(" ").filter(Boolean);
	return parts[0] || cleaned;
}

function isBadTitle(title: string): boolean {
	const t = title.toLowerCase().trim();
	const bad = ["播放", "暂停", "youtube music", "music", "播放器", "queue", "队列", "接下来播放", ""];
	return bad.includes(t);
}

function pickBestLrclibHit(
	hits: LrclibTrack[],
	song: { title: string; artist: string },
	duration: number,
): LrclibTrack | null {
	if (hits.length === 0) return null;
	const wantTitle = song.title.toLowerCase().trim();
	const wantArtist = song.artist.toLowerCase().trim();
	let best: LrclibTrack | null = null;
	let bestScore = -1;
	for (const h of hits) {
		let score = 0;
		if (h.syncedLyrics) score += 100;
		else if (h.plainLyrics) score += 10;
		if (h.trackName && h.trackName.toLowerCase().includes(wantTitle)) score += 30;
		if (h.artistName && wantArtist && h.artistName.toLowerCase().includes(wantArtist.split(" ")[0] || "")) score += 30;
		else if (h.artistName && wantArtist && wantArtist.includes(h.artistName.toLowerCase())) score += 20;
		if (duration > 0 && h.duration && Math.abs(h.duration - duration) < 4) score += 25;
		if (h.instrumental) score -= 50;
		if (score > bestScore) {
			bestScore = score;
			best = h;
		}
	}
	return best;
}

function getSongDuration(): number {
	const v = getVideo();
	if (v && v.duration && isFinite(v.duration) && v.duration > 0) return v.duration;
	const bar = document.querySelector("ytmusic-player-bar");
	const progressBar = bar?.querySelector("#progress-bar");
	if (progressBar) {
		const max = progressBar.getAttribute("aria-valuemax");
		if (max) {
			const n = Number(max);
			if (n > 0 && isFinite(n)) return n;
		}
	}
	const timeInfo = bar?.querySelector("#time-info, .time-info, yt-formatted-string.time-info");
	const text = timeInfo?.textContent || "";
	const m = text.match(/(\d+):(\d+)\s*\/\s*(\d+):(\d+)/);
	if (m) return Number(m[3]) * 60 + Number(m[4]);
	const m2 = text.match(/(\d+):(\d+)/);
	if (m2) return Number(m2[1]) * 60 + Number(m2[2]);
	return 0;
}

const LYRIC_EXT_PARSERS: Record<string, (s: string) => LyricLine[]> = {
	ttml: (s) => parseTTML(s).lines,
	lrc: (s) => parseLrc(s).map(mapLyric),
	yrc: (s) => parseYrc(s).map(mapLyric),
	qrc: (s) => parseQrc(s).map(mapLyric),
	lys: (s) => parseLys(s).map(mapLyric),
};

function mapLyric(line: RawLyricLine): LyricLine {
	return {
		words: line.words.map((w) => ({
			word: w.word,
			startTime: w.startTime,
			endTime: w.endTime,
			romanWord: w.romanWord ?? "",
		})),
		startTime: line.words[0]?.startTime ?? 0,
		endTime:
			line.words[line.words.length - 1]?.endTime ??
			Number.POSITIVE_INFINITY,
		translatedLyric: line.translatedLyric ?? "",
		romanLyric: line.romanLyric ?? "",
		isBG: line.isBG ?? false,
		isDuet: line.isDuet ?? false,
	};
}

function parseLyricFile(name: string, content: string): LyricLine[] | null {
	const ext = name.toLowerCase().split(".").pop() ?? "";
	const parser = LYRIC_EXT_PARSERS[ext];
	if (!parser) return null;
	try {
		return parser(content);
	} catch (e) {
		LOG("parse error", ext, e);
		return null;
	}
}

function injectStyles() {
	if (document.querySelector("#amll-ytm-styles")) return;
	injectFontLinks();
	const style = document.createElement("style");
	style.id = "amll-ytm-styles";
	style.textContent = amllCoreCss + "\n" + CUSTOM_CSS;
	document.documentElement.appendChild(style);
}

function injectFontLinks() {
	if (document.querySelector("#amll-ytm-fonts-regular")) return;
	const regular = document.createElement("link");
	regular.id = "amll-ytm-fonts-regular";
	regular.rel = "stylesheet";
	regular.href =
		"https://s1.hdslb.com/bfs/static/jinkela/long/font/regular.css";
	const medium = document.createElement("link");
	medium.id = "amll-ytm-fonts-medium";
	medium.rel = "stylesheet";
	medium.href =
		"https://s1.hdslb.com/bfs/static/jinkela/long/font/medium.css";
	document.documentElement.appendChild(regular);
	document.documentElement.appendChild(medium);
	regular.addEventListener("error", () => {
		LOG("font <link> blocked by CSP, falling back to data URI");
		void injectFontsViaDataUri();
	});
	regular.addEventListener("load", () => {
		LOG("font <link> loaded ok");
	});
}

const FONT_BASE =
	"https://s1.hdslb.com/bfs/static/jinkela/long/font/HarmonyOS_Regular.";
const FONT_SUBSETS: { key: string; range: string }[] = [
	{ key: "a1", range: "U+21-7e,U+a4,U+a7-a8,U+b0-b1,U+b7" },
	{ key: "a0", range: "U+d7,U+e0-e1,U+e8-ea,U+ec-ed,U+f2-f3,U+f7,U+f9-fa,U+fc,U+2014,U+2018-2019,U+201c-201d,U+3001-3002,U+300a-300b,U+3010-3011,U+4e00-4e01,U+4e03,U+4e07-4e0b,U+4e0d-4e0e,U+4e10-4e11,U+4e13-4e14,U+4e16,U+4e18-4e1e,U+4e22,U+4e24-4e25,U+4e27,U+4e2a-4e2b,U+4e2d,U+4e30,U+4e32,U+4e34,U+4e38-4e3b,U+4e3d-4e3e,U+4e43,U+4e45,U+4e48-4e49,U+4e4b-4e50,U+4e52-4e54,U+4e56,U+4e58-4e59,U+4e5c-4e61,U+4e66,U+4e70-4e71,U+4e73,U+4e7e,U+4e86,U+4e88-4e89,U+4e8b-4e8c,U+4e8e-4e8f,U+4e91-4e93" },
	{ key: "az", range: "U+4e94-4e95,U+4e98,U+4e9a-4e9b,U+4e9f,U+4ea1-4ea2,U+4ea4-4ea9,U+4eab-4eae,U+4eb2,U+4eb5,U+4eba,U+4ebf-4ec1,U+4ec3-4ec7,U+4eca-4ecb,U+4ecd-4ece,U+4ed1,U+4ed3-4ed9,U+4ede-4edf,U+4ee3-4ee5,U+4ee8,U+4eea,U+4eec,U+4ef0,U+4ef2,U+4ef5-4ef7,U+4efb,U+4efd,U+4eff,U+4f01,U+4f0a,U+4f0d-4f11,U+4f17-4f1a,U+4f1e-4f20,U+4f22,U+4f24-4f26,U+4f2a-4f2b,U+4f2f-4f30,U+4f34,U+4f36,U+4f38,U+4f3a,U+4f3c-4f3d,U+4f43,U+4f46,U+4f4d-4f51,U+4f53,U+4f55,U+4f58-4f59,U+4f5b-4f5e" },
	{ key: "ay", range: "U+4f60,U+4f63,U+4f65,U+4f69,U+4f6c,U+4f6f-4f70,U+4f73-4f74,U+4f7b-4f7c,U+4f7f,U+4f83-4f84,U+4f88,U+4f8b,U+4f8d,U+4f97,U+4f9b,U+4f9d,U+4fa0,U+4fa3,U+4fa5-4faa,U+4fac,U+4fae-4faf,U+4fb5,U+4fbf,U+4fc3-4fc5,U+4fca,U+4fce-4fd1,U+4fd7-4fd8,U+4fda,U+4fdd-4fde,U+4fe1,U+4fe6,U+4fe8-4fe9,U+4fed-4fef,U+4ff1,U+4ff8,U+4ffa,U+4ffe,U+500c-500d,U+500f,U+5012,U+5014,U+5018-501a,U+501c,U+501f,U+5021,U+5026,U+5028-502a,U+502d,U+503a,U+503c,U+503e,U+5043,U+5047-5048,U+504c,U+504e-504f,U+5055,U+505a,U+505c,U+5065,U+5076-5077,U+507b,U+507f-5080,U+5085,U+5088,U+508d,U+50a3,U+50a5,U+50a8,U+50ac,U+50b2,U+50bb" },
	{ key: "ax", range: "U+50cf,U+50d6,U+50da,U+50e7,U+50ee,U+50f3,U+50f5,U+50fb,U+5106,U+510b,U+5112,U+5121,U+513f-5141,U+5143-5146,U+5148-5149,U+514b,U+514d,U+5151,U+5154,U+515a,U+515c,U+5162,U+5165,U+5168,U+516b-516e,U+5170-5171,U+5173-5179,U+517b-517d,U+5180,U+5185,U+5188-5189,U+518c-518d,U+5192,U+5195,U+5197,U+5199,U+519b-519c,U+51a0,U+51a2,U+51a4-51a5,U+51ac,U+51af-51b0,U+51b2-51b3,U+51b5-51b7,U+51bb,U+51bd,U+51c0,U+51c4,U+51c6,U+51c9,U+51cb-51cc,U+51cf,U+51d1,U+51db,U+51dd,U+51e0-51e1,U+51e4,U+51ed,U+51ef-51f0,U+51f3,U+51f6,U+51f8-51fb,U+51fd,U+51ff-5201,U+5203,U+5206" },
	{ key: "aw", range: "U+5207,U+520a,U+520d-520e,U+5211-5212,U+5217-521b,U+521d,U+5220,U+5224,U+5228-5229,U+522b,U+522d-522e,U+5230,U+5236-523b,U+523d,U+5241-5243,U+524a,U+524c-524d,U+5250-5251,U+5254,U+5256,U+525c,U+5265,U+5267,U+5269-526a,U+526f,U+5272,U+527d,U+527f,U+5288,U+529b,U+529d-52a1,U+52a3,U+52a8-52ab,U+52ad,U+52b1-52b3,U+52be-52bf,U+52c3,U+52c7,U+52c9,U+52cb,U+52d0,U+52d2,U+52d8,U+52df,U+52e4,U+52fa,U+52fe-5300,U+5305-5306,U+5308,U+530d,U+5310,U+5315-5317,U+5319,U+531d,U+5320-5321,U+5323,U+532a,U+532e,U+5339-533b,U+533e-533f,U+5341,U+5343,U+5347" },
	{ key: "av", range: "U+5348-534a,U+534e-534f,U+5351-5353,U+5355-5357,U+535a,U+535c,U+535e-5362,U+5364,U+5366-5367,U+536b,U+536f-5371,U+5373-5375,U+5377-5378,U+537f,U+5382,U+5384-5386,U+5389,U+538b-538c,U+5395,U+5398,U+539a,U+539f,U+53a2,U+53a5-53a6,U+53a8-53a9,U+53ae,U+53bb,U+53bf,U+53c1-53c2,U+53c8-53cd,U+53d1,U+53d4,U+53d6-53d9,U+53db,U+53df-53e0,U+53e3-53e6,U+53e8-53f3,U+53f6-53f9,U+53fc-53fd,U+5401,U+5403-5404,U+5408-540a,U+540c-5410" },
	{ key: "au", range: "U+5411,U+5413,U+5415,U+5417,U+541b,U+541d-5420,U+5426-5429,U+542b-542f,U+5431,U+5434-5435,U+5438-5439,U+543b-543c,U+543e,U+5440,U+5443,U+5446,U+5448,U+544a,U+5450,U+5453,U+5455,U+5457-5458,U+545b-545c,U+5462,U+5464,U+5466,U+5468,U+5471-5473,U+5475,U+5478,U+547b-547d,U+5480,U+5482,U+5484,U+5486,U+548b-548c,U+548e-5490,U+5492,U+5494-5496,U+5499-549b,U+54a4,U+54a6-54ad,U+54af,U+54b1,U+54b3,U+54b8,U+54bb,U+54bd,U+54bf-54c2,U+54c4,U+54c6-54c9,U+54cd-54ce,U+54d0-54d2,U+54d5,U+54d7,U+54da,U+54dd,U+54df" },
	{ key: "at", range: "U+54e5-54ea,U+54ed-54ee,U+54f2,U+54fa,U+54fc-54fd,U+5501,U+5506-5507,U+5509,U+550f-5510,U+5514,U+5520,U+5522,U+5524,U+5527,U+552c,U+552e-5531,U+5533,U+553e-553f,U+5543-5544,U+5546,U+554a,U+5550,U+5555-5556,U+555c,U+5561,U+5564-5567,U+556a,U+556c,U+556e,U+5575,U+5577-5578,U+557b-557c,U+557e,U+5580,U+5582-5584,U+5587,U+5589-558b,U+558f,U+5591,U+5594,U+5598-5599,U+559c-559d,U+559f,U+55a7,U+55b3,U+55b7,U+55bb,U+55bd,U+55c5,U+55d1-55d4,U+55d6,U+55dc-55dd,U+55df,U+55e1,U+55e3-55e6,U+55e8,U+55eb-55ec,U+55ef,U+55f7,U+55fd,U+5600-5601,U+5608-5609,U+560e,U+5618" },
	{ key: "as", range: "U+561b,U+561e-561f,U+5624,U+562d,U+5631-5632,U+5634,U+5636,U+5639,U+563b,U+563f,U+564c,U+564e,U+5654,U+5657,U+5659,U+565c,U+5662,U+5664,U+5668-566c,U+5676,U+567c,U+5685,U+568e-568f,U+5693,U+56a3,U+56b7,U+56bc,U+56ca,U+56d4,U+56da-56db,U+56de,U+56e0,U+56e2,U+56e4,U+56ed,U+56f0-56f1,U+56f4,U+56f9-56fa,U+56fd-56ff,U+5703,U+5706,U+5708-5709,U+571f,U+5723,U+5728,U+572d,U+5730,U+573a,U+573e,U+5740,U+5747,U+574a,U+574d-5751,U+5757,U+575a-575b,U+575d-5761,U+5764,U+5766,U+5768,U+576a,U+576f,U+5773,U+5777,U+5782-5784,U+578b,U+5792,U+579b,U+57a0,U+57a2-57a3,U+57a6,U+57ab,U+57ae,U+57c2-57c3,U+57cb" },
	{ key: "ar", range: "U+57ce,U+57d4,U+57df-57e0,U+57f9-57fa,U+5800,U+5802,U+5806,U+5811,U+5815,U+5821,U+5824,U+582a,U+5830,U+5835,U+584c,U+5851,U+5854,U+5858,U+585e,U+586b,U+587e,U+5883,U+5885,U+5892-5893,U+5899,U+589e-589f,U+58a8-58a9,U+58c1,U+58d1,U+58d5,U+58e4,U+58eb-58ec,U+58ee,U+58f0,U+58f3,U+58f6,U+58f9,U+5904,U+5907,U+590d,U+590f,U+5915-5916,U+5919-591a,U+591c,U+591f,U+5927,U+5929-592b,U+592d-592f,U+5931,U+5934,U+5937-593a,U+5942,U+5944,U+5947-5949,U+594b,U+594e-594f,U+5951,U+5954-5957,U+595a,U+5960,U+5962,U+5965,U+5973-5974,U+5976,U+5978-5979,U+597d,U+5981-5984,U+5986-5988,U+598a,U+598d,U+5992-5993" },
	{ key: "aq", range: "U+5996,U+5999,U+599e,U+59a5,U+59a8-59aa,U+59ae,U+59b2,U+59b9,U+59bb,U+59be,U+59c6,U+59cb,U+59d0-59d1,U+59d3-59d4,U+59d7-59d8,U+59da,U+59dc-59dd,U+59e3,U+59e5,U+59e8,U+59ec,U+59f9,U+59fb,U+59ff,U+5a01,U+5a03-5a04,U+5a06-5a07,U+5a11,U+5a13,U+5a18,U+5a1c,U+5a1f-5a20,U+5a25,U+5a29,U+5a31-5a32,U+5a34,U+5a36,U+5a3c,U+5a40,U+5a46,U+5a49-5a4a,U+5a5a,U+5a62,U+5a6a,U+5a74,U+5a76-5a77,U+5a7f,U+5a92,U+5a9a-5a9b,U+5ab2-5ab3,U+5ac1-5ac2,U+5ac9,U+5acc,U+5ad4,U+5ad6,U+5ae1,U+5ae3,U+5ae6,U+5ae9,U+5b09,U+5b34,U+5b37,U+5b40,U+5b50,U+5b54-5b55,U+5b57-5b59,U+5b5c-5b5d,U+5b5f,U+5b63-5b64,U+5b66,U+5b69-5b6a,U+5b6c,U+5b70-5b71,U+5b75,U+5b7a,U+5b7d,U+5b81,U+5b83" },
];

async function injectFontsViaDataUri() {
	if (document.querySelector("#amll-ytm-fonts-data")) return;
	const style = document.createElement("style");
	style.id = "amll-ytm-fonts-data";
	document.documentElement.appendChild(style);
	let cssText = "";
	const loaded = new Set<string>();
	for (const sub of FONT_SUBSETS) {
		try {
			const dataUrl = await sendBg<{ dataUrl: string }>({
				type: "amll:fetch-data-url",
				url: FONT_BASE + sub.key + ".woff2",
			});
			cssText += `@font-face{font-family:'HarmonyOS_Regular';font-style:normal;font-weight:400;font-display:swap;src:url('${dataUrl}') format('woff2');unicode-range:${sub.range};}\n`;
			loaded.add(sub.key);
			style.textContent = cssText;
		} catch (e) {
			LOG("font subset", sub.key, "failed", e);
		}
	}
	LOG("fonts via data uri loaded:", loaded.size, "/", FONT_SUBSETS.length);
}

function sendBg<T>(msg: unknown): Promise<T> {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(msg, (res) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
			} else if (res?.ok === false) {
				reject(new Error(res.error));
			} else if (res?.ok) {
				resolve(res);
			} else {
				reject(new Error("no response"));
			}
		});
	});
}

const CUSTOM_CSS = `
.amll-ytm-root {
	position: absolute;
	inset: 0;
	overflow: hidden;
	z-index: 0;
	pointer-events: none;
}
.amll-ytm-root.active { pointer-events: auto; }
.amll-ytm-root.toolbar-hidden { pointer-events: none; }
.amll-ytm-bg {
	position: absolute;
	inset: 0;
	background: #000;
	z-index: 0;
	display: none;
}
.amll-ytm-root {
	background: #000;
}
.amll-ytm-player-wrap {
	position: absolute;
	inset: 0;
	z-index: 1;
}
.amll-ytm-player-wrap .amll-lyric-player {
	--amll-lp-color: #ffffff;
	--amll-lp-bg-color: transparent;
	--amll-lp-font-size: max(max(3.2vh, 1.6vw), 12px);
	height: 100%;
	font-family: 'HarmonyOS_Medium', 'HarmonyOS_Regular', system-ui, -apple-system, 'Segoe UI', sans-serif;
	font-weight: 500;
}
.amll-ytm-toolbar {
	position: absolute;
	top: 12px;
	right: 16px;
	z-index: 100;
	display: flex;
	gap: 8px;
	opacity: 1;
	transition: opacity 250ms;
	pointer-events: auto !important;
}
.amll-ytm-root .amll-ytm-toolbar { opacity: 1; pointer-events: auto; }
.amll-ytm-toolbar:hover { opacity: 1 !important; }
.amll-ytm-root.toolbar-hidden .amll-ytm-toolbar { opacity: 0 !important; pointer-events: none !important; }
.amll-ytm-restore-dot {
	position: absolute;
	top: 12px;
	right: 12px;
	z-index: 4;
	width: 14px;
	height: 14px;
	border-radius: 50%;
	background: rgba(251, 92, 116, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.3);
	cursor: pointer;
	opacity: 0.5;
	transition: opacity 200ms, transform 200ms;
	display: block;
}
.amll-ytm-restore-dot:hover {
	opacity: 1 !important;
	background: rgba(251, 92, 116, 1);
	transform: scale(1.4);
}
.amll-ytm-root:not(.toolbar-hidden) .amll-ytm-restore-dot {
	display: none;
}
.amll-ytm-btn {
	background: rgba(0,0,0,0.45);
	color: #fff;
	border: 1px solid rgba(255,255,255,0.2);
	border-radius: 999px;
	padding: 5px 12px;
	font-size: 11px;
	cursor: pointer;
	backdrop-filter: blur(8px);
	white-space: nowrap;
}
.amll-ytm-btn:hover { background: rgba(0,0,0,0.65); }
.amll-ytm-empty {
	position: absolute;
	inset: 0;
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	color: rgba(255,255,255,0.7);
	gap: 14px;
	padding: 24px;
}
.amll-ytm-empty h3 { margin: 0; font-size: 16px; font-weight: 600; }
.amll-ytm-empty p { margin: 0; font-size: 13px; line-height: 1.6; max-width: 320px; }
.amll-ytm-empty .amll-ytm-btn { pointer-events: auto; }
.amll-ytm-root.dragover { box-shadow: inset 0 0 0 2px #fb5c74; }
ytmusic-description-shelf-renderer.amll-native-hidden > .wrapper > *:not(.amll-ytm-root) {
	display: none !important;
}
ytmusic-description-shelf-renderer.amll-native-hidden > .wrapper,
ytmusic-description-shelf-renderer.amll-native-hidden {
	min-height: calc(100vh - 100px) !important;
}
ytmusic-description-shelf-renderer.amll-native-hidden {
	display: block !important;
}
ytmusic-description-shelf-renderer.amll-native-hidden::-webkit-scrollbar,
ytmusic-description-shelf-renderer.amll-native-hidden .wrapper::-webkit-scrollbar {
	display: none !important;
	width: 0 !important;
}
ytmusic-description-shelf-renderer.amll-native-hidden,
ytmusic-description-shelf-renderer.amll-native-hidden .wrapper {
	scrollbar-width: none !important;
	-ms-overflow-style: none !important;
}

.amll-ytm-player-wrap .amll-lyric-player.dom {
	line-height: 1.45;
	contain: none;
	overflow: visible;
	--amll-lp-align-anchor: center;
	--amll-lp-align-position: 0.4;
}
.amll-ytm-player-wrap::-webkit-scrollbar,
.amll-ytm-root::-webkit-scrollbar,
.amll-ytm-player-wrap .amll-lyric-player::-webkit-scrollbar {
	display: none !important;
	width: 0 !important;
	height: 0 !important;
}
.amll-ytm-player-wrap,
.amll-ytm-player-wrap .amll-lyric-player {
	scrollbar-width: none !important;
	-ms-overflow-style: none !important;
}
.amll-ytm-player-wrap ._2NbXLG_lyricLineWrapper {
	padding-block: 0.5em;
}
.amll-ytm-player-wrap ._2NbXLG_lyricLine {
	contain: layout style;
	padding-bottom: 0.25em;
}
.amll-ytm-player-wrap ._2NbXLG_lyricMainLine {
	padding-block: 1.2em 1.4em;
}
.amll-ytm-player-wrap ._2NbXLG_lyricMainLine > span,
.amll-ytm-player-wrap ._2NbXLG_lyricMainLine span._2NbXLG_emphasizeWrapper {
	padding-block: 1em 1.25em;
	margin-block: -1em -1.25em;
}
`;

class AMLLController {
	player = new DomLyricPlayer();
	root = document.createElement("div");
	bg = document.createElement("div");
	playerWrap = document.createElement("div");
	toolbar = document.createElement("div");
	empty = document.createElement("div");
	toggleBtn = document.createElement("button");
	importBtn = document.createElement("button");
	searchBtn = document.createElement("button");
	hideBtn = document.createElement("button");
	restoreDot = document.createElement("div");

	rafId = 0;
	lastFrame = 0;
	enabled = true;
	mounted = false;
	toolbarHidden = false;
	currentSong: SongInfo | null = null;
	currentLines: LyricLine[] | null = null;
	lyricLoadToken = 0;

	constructor() {
		this.root.className = "amll-ytm-root";
		this.bg.className = "amll-ytm-bg";
		this.playerWrap.className = "amll-ytm-player-wrap";
		this.toolbar.className = "amll-ytm-toolbar";
		this.empty.className = "amll-ytm-empty";
		this.restoreDot.className = "amll-ytm-restore-dot";

		this.playerWrap.appendChild(this.player.getElement());
		this.root.append(this.bg, this.playerWrap, this.toolbar, this.empty, this.restoreDot);

		this.toggleBtn.className = this.importBtn.className = this.searchBtn.className = this.hideBtn.className = "amll-ytm-btn";
		this.toggleBtn.textContent = "AMLL 开";
		this.importBtn.textContent = "导入歌词";
		this.searchBtn.textContent = "搜索歌词";
		this.hideBtn.textContent = "隐藏按钮";
		this.toggleBtn.onclick = () => this.toggle();
		this.importBtn.onclick = () => this.openFilePicker();
		this.searchBtn.onclick = () => this.manualSearch();
		this.hideBtn.onclick = () => this.hideToolbar();
		this.restoreDot.onclick = () => this.showToolbar();
		this.restoreDot.title = "显示 AMLL 工具栏";
		this.toolbar.append(this.searchBtn, this.toggleBtn, this.importBtn, this.hideBtn);

		this.player.setEnableSpring(true);
		this.player.setEnableScale(true);
		this.player.setEnableBlur(true);
		this.player.setAlignAnchor("center");
		this.player.addEventListener("line-click", (e) => {
			const evt = e as { line: { getLine: () => LyricLine } };
			const time = evt.line?.getLine?.()?.startTime;
			if (typeof time === "number") {
				this.player.resetScroll();
				this.seekTo(time / 1000);
			}
		});

		this.setupDragDrop();
		this.setupShortcut();
		this.setupToolbarToggle();
		this.startRaf();
		this.refreshToggleButton();
	}

	private setupDragDrop() {
		const root = this.root;
		root.addEventListener("dragover", (e) => {
			e.preventDefault();
			root.classList.add("dragover");
		});
		root.addEventListener("dragleave", () =>
			root.classList.remove("dragover"),
		);
		root.addEventListener("drop", (e) => {
			e.preventDefault();
			root.classList.remove("dragover");
			const file = e.dataTransfer?.files?.[0];
			if (file) this.handleLyricFile(file);
		});
	}

	private setupShortcut() {
		window.addEventListener("keydown", (e) => {
			if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
				e.preventDefault();
				this.openFilePicker();
			}
			if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "h") {
				e.preventDefault();
				if (this.toolbarHidden) this.showToolbar();
				else this.hideToolbar();
			}
		});
	}

	private setupToolbarToggle() {
		let lastClick = 0;
		this.playerWrap.addEventListener("dblclick", (e) => {
			e.preventDefault();
			const now = Date.now();
			if (now - lastClick < 350) {
				if (this.toolbarHidden) this.showToolbar();
				else this.hideToolbar();
			}
			lastClick = now;
		});
		this.playerWrap.addEventListener("click", (e) => {
			const now = Date.now();
			if (now - lastClick < 350) {
				if (this.toolbarHidden) this.showToolbar();
			}
			lastClick = now;
		});
	}

	openFilePicker() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".ttml,.lrc,.yrc,.qrc,.lys,.eslrc";
		input.onchange = () => {
			const file = input.files?.[0];
			if (file) this.handleLyricFile(file);
		};
		input.click();
	}

	async handleLyricFile(file: File) {
		const content = await file.text();
		const lines = parseLyricFile(file.name, content);
		if (!lines || lines.length === 0) {
			this.showEmpty("解析失败", "无法解析此歌词文件，请检查格式。");
			return;
		}
		this.setLyricLines(lines);
		this.currentLines = lines;
		if (this.currentSong) {
			const ext = file.name.toLowerCase().split(".").pop() ?? "ttml";
			const key = lyricStorageKey(this.currentSong);
			const stored: StoredLyric = { ext, content };
			await chrome.storage.local.set({ [key]: stored });
			LOG("cached lyric for", this.currentSong.id);
		}
	}

	setLyricLines(lines: LyricLine[]) {
		this.player.setLyricLines(lines);
		this.empty.style.display = "none";
	}

	showEmpty(title: string, hint: string) {
		this.player.setLyricLines([]);
		this.empty.style.display = "flex";
		this.empty.innerHTML = "";
		const h = document.createElement("h3");
		h.textContent = title;
		const p = document.createElement("p");
		p.innerHTML = hint;
		const btn = document.createElement("button");
		btn.className = "amll-ytm-btn";
		btn.textContent = "导入歌词文件 (.ttml/.lrc/.yrc/.qrc/.lys)";
		btn.onclick = () => this.openFilePicker();
		this.empty.append(h, p, btn);
	}

	toggle() {
		this.enabled = !this.enabled;
		this.refreshToggleButton();
		this.updateVisibility();
		if (this.enabled && this.currentSong && !this.currentLines) {
			void this.loadLyricForSong(this.currentSong);
		}
	}

	hideToolbar() {
		this.toolbarHidden = true;
		this.root.classList.add("toolbar-hidden");
	}

	showToolbar() {
		this.toolbarHidden = false;
		this.root.classList.remove("toolbar-hidden");
	}

	refreshToggleButton() {
		this.toggleBtn.textContent = this.enabled ? "AMLL 开" : "AMLL 关";
	}

	setEnabled(en: boolean) {
		this.enabled = en;
		this.refreshToggleButton();
		this.updateVisibility();
	}

	setToolbarHidden(hidden: boolean) {
		this.toolbarHidden = hidden;
		this.root.classList.toggle("toolbar-hidden", hidden);
	}

	mount(parent: HTMLElement) {
		if (this.mounted) return;
		if (getComputedStyle(parent).position === "static") {
			parent.style.position = "relative";
		}
		parent.style.scrollbarWidth = "none";
		parent.style.setProperty("-ms-overflow-style", "none");
		parent.style.setProperty("overflow-y", "auto", "important");
		const style = document.createElement("style");
		style.textContent = `*::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }`;
		style.id = "amll-hide-scrollbars";
		parent.prepend(style);
		parent.appendChild(this.root);
		this.mounted = true;
		this.enabled = true;
		this.root.classList.add("active");
		this.root.classList.remove("toolbar-hidden");
		this.toolbarHidden = false;
		this.updateVisibility();
		const pe = this.player.getElement();
		LOG("mount: parent=", parent.tagName, parent.className, "size=", parent.clientWidth, "x", parent.clientHeight,
			"| root=", this.root.clientWidth, "x", this.root.clientHeight,
			"| playerWrap=", this.playerWrap.clientWidth, "x", this.playerWrap.clientHeight,
			"| playerEl=", pe.clientWidth, "x", pe.clientHeight,
			"| root display=", getComputedStyle(this.root).display);
	}

	unmount() {
		if (!this.mounted) return;
		const parent = this.root.parentElement;
		parent?.querySelector("#amll-hide-scrollbars")?.remove();
		this.root.remove();
		this.mounted = false;
	}

	updateVisibility() {
		this.root.classList.toggle("active", this.enabled);
		this.playerWrap.style.display = this.enabled ? "" : "none";
		if (!this.enabled) {
			this.root.style.display = "none";
		} else {
			this.root.style.display = "";
		}
	}

	setCover(cover: string) {
		if (cover) this.bg.style.backgroundImage = `url("${cover}")`;
	}

	setSong(song: SongInfo) {
		const isSame = this.currentSong?.id === song.id && this.currentSong?.title === song.title;
		this.currentSong = song;
		this.setCover(song.cover);
		this.currentLines = null;
		this.player.setLyricLines([]);
		this.player.resetScroll();
		if (isSame) return;
		LOG("setSong: new song, forcing reload");
		void this.loadLyricForSong(song);
	}

	async loadLyricForSong(song: SongInfo) {
		const loadToken = ++this.lyricLoadToken;
		const key = lyricStorageKey(song);
		const result = await chrome.storage.local.get(key);
		if (loadToken !== this.lyricLoadToken) return;
		const stored = result[key] as StoredLyric | undefined;
		if (stored && song.title && !isBadTitle(song.title)) {
			const lines = parseLyricFile(`x.${stored.ext}`, stored.content);
			if (lines && lines.length > 0) {
				LOG("loaded cached lyric for", song.id, "| ext:", stored.ext, "| lines:", lines.length);
				if (loadToken !== this.lyricLoadToken) return;
				this.setLyricLines(lines);
				this.currentLines = lines;
				return;
			}
		}
		void this.autoSearchLyric(song, loadToken);
	}

	async autoSearchLyric(song: SongInfo, loadToken?: number) {
		const token = loadToken ?? ++this.lyricLoadToken;
		if (!song.title || song.title.length < 2) {
			LOG("skip autoSearch: title too short", song.title);
			return;
		}
		const lowerTitle = song.title.toLowerCase();
		const badTitles = ["播放", "暂停", "youtube music", "music", "播放器", "queue", "队列", "接下来播放"];
		if (badTitles.includes(lowerTitle)) {
			LOG("skip autoSearch: invalid title", song.title);
			return;
		}
		const searchTitle = song.title.replace(/\s*[（(].*$/, "").trim() || song.title;
		this.showEmpty("正在搜索歌词…", `当前歌曲：<b>${escapeHtml(song.title)}</b> — ${escapeHtml(song.artist)}<br>正在准备搜索…`);
		try {
			const duration = getSongDuration();
			const cleanArtist = cleanArtistName(song.artist);
			LOG("autoSearch: searchTitle=", searchTitle, "rawTitle=", song.title, "rawArtist=", song.artist, "cleanArtist=", cleanArtist, "duration=", duration);

			const lyricResult = await this.searchMultipleSources(searchTitle, cleanArtist, duration);
			if (token !== this.lyricLoadToken) return;
			if (lyricResult) {
				const { text: lyricText, ext } = lyricResult;
				const lines = parseLyricFile(`auto.${ext}`, lyricText);
				if (lines && lines.length > 0) {
					LOG("lyric loaded, ext:", ext, "lines:", lines.length);
					if (token !== this.lyricLoadToken) return;
					this.setLyricLines(lines);
					this.currentLines = lines;
					const stored: StoredLyric = { ext, content: lyricText };
					await chrome.storage.local.set({ [lyricStorageKey(song)]: stored });
					return;
				}
			}
			if (token !== this.lyricLoadToken) return;
			this.showEmpty(
				"未找到歌词",
				`当前歌曲：<b>${escapeHtml(song.title)}</b><br>所有歌词库均未找到匹配歌词。可将 .ttml / .lrc / .yrc / .qrc / .lys 文件拖入此处导入，或点击"搜索歌词"重试。`,
			);
		} catch (e) {
			if (token !== this.lyricLoadToken) return;
			LOG("autoSearch failed", e);
			this.showEmpty(
				"搜索失败",
				`当前歌曲：<b>${escapeHtml(song.title)}</b><br>搜索出错：${escapeHtml(String(e))}<br>可将歌词文件拖入此处手动导入。`,
			);
		}
	}

	async searchMultipleSources(title: string, artist: string, duration: number): Promise<{ text: string; ext: string } | null> {
		const sources: { name: string; fn: () => Promise<string | null> }[] = [
			{ name: "AMLL-DB(ncm)", fn: () => this.searchAmllDbNcm(title, artist, duration) },
			{ name: "AMLL-DB(applemusic)", fn: () => this.searchAmllDb(title, artist) },
			{ name: "LRCLIB(synced)", fn: () => this.searchLrclib(title, artist, duration, true) },
			{ name: "LRCLIB(any)", fn: () => this.searchLrclib(title, artist, duration, false) },
			{ name: "LRCLIB(title-only)", fn: () => this.searchLrclib(title, "", 0, false) },
		];
		for (const src of sources) {
			try {
				this.showEmpty("正在搜索歌词…", `当前歌曲：<b>${escapeHtml(title)}</b> — ${escapeHtml(artist)}<br>正在从 <b>${src.name}</b> 搜索…`);
				LOG("trying source:", src.name);
				const result = await src.fn();
				if (result) {
					LOG("source", src.name, "returned lyrics, len=", result.length);
					const trimmed = result.trimStart();
					let ext = "lrc";
					if (trimmed.startsWith("<")) ext = "ttml";
					else if (/^\s*\[\d+,\d+\]/.test(trimmed)) ext = "qrc";
					const lines = parseLyricFile(`auto.${ext}`, result);
					if (lines && lines.length > 0) {
						LOG("source", src.name, "parsed ok, ext:", ext, "lines:", lines.length);
						return { text: result, ext };
					}
					LOG("source", src.name, "returned text but parse failed, trying next");
				}
			} catch (e) {
				LOG("source", src.name, "failed:", e);
			}
		}
		return null;
	}

	async searchAmllDbNcm(title: string, artist: string, duration: number): Promise<string | null> {
		const ncmId = await this.searchNcmId(title, artist, duration);
		if (!ncmId) return null;
		LOG("NCM ID found:", ncmId, "fetching AMLL DB TTML...");
		const mirrors = [
			`https://amll-ttml-db.stevexmh.net/ncm/${ncmId}`,
			`https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/ncm-lyrics/${ncmId}.ttml`,
		];
		for (const murl of mirrors) {
			try {
				LOG("fetching AMLL DB NCM:", murl);
				const res = await sendBg<{ text: string }>({ type: "amll:fetch-text", url: murl });
				if (res.text && res.text.includes("<tt")) {
					LOG("AMLL DB NCM TTML found, len:", res.text.length);
					return res.text;
				}
			} catch (e) {
				LOG("AMLL DB NCM mirror failed:", e);
			}
		}
		return null;
	}

	async searchNcmId(title: string, artist: string, duration: number): Promise<string | null> {
		const cleanArtist = cleanArtistName(artist);
		const searchTerm = cleanArtist ? `${title} ${cleanArtist}` : title;
		const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(searchTerm)}&type=1&limit=10&offset=0`;
		LOG("NCM search:", url);
		const res = await sendBg<{ json: NcmSearchResponse }>({ type: "amll:fetch-json", url });
		const songs = res.json?.result?.songs || [];
		LOG("NCM songs:", songs.length);
		if (songs.length === 0) return null;
		const wantTitle = title.toLowerCase().trim();
		const wantArtist = cleanArtist.toLowerCase().trim();
		let bestId = "";
		let bestScore = -1;
		for (const s of songs) {
			let score = 0;
			if (s.name && s.name.toLowerCase().includes(wantTitle)) score += 40;
			const sArtist = (s.artists?.[0]?.name || "").toLowerCase();
			if (sArtist && wantArtist && sArtist.includes(wantArtist)) score += 30;
			else if (sArtist && wantArtist && wantArtist.includes(sArtist)) score += 20;
			const sDur = (s.duration || 0) / 1000;
			if (duration > 0 && sDur > 0 && Math.abs(sDur - duration) < 5) score += 25;
			if (score > bestScore) {
				bestScore = score;
				bestId = String(s.id);
			}
		}
		if (bestScore < 20) return null;
		LOG("best NCM ID:", bestId, "score:", bestScore);
		return bestId;
	}

	async searchAmllDb(title: string, artist: string): Promise<string | null> {
		const cleanArtist = cleanArtistName(artist);
		const term = `${title} ${cleanArtist}`.trim();
		const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=10`;
		LOG("iTunes search:", url);
		const res = await sendBg<{ json: ItunesResponse }>({ type: "amll:fetch-json", url });
		const results = res.json?.results || [];
		LOG("iTunes results:", results.length);
		if (results.length === 0) return null;
		const wantTitle = title.toLowerCase().trim();
		const wantArtist = cleanArtist.toLowerCase().trim();
		let bestId = "";
		let bestScore = -1;
		for (const r of results) {
			let score = 0;
			if (r.trackName && r.trackName.toLowerCase().includes(wantTitle)) score += 40;
			if (r.artistName && r.artistName.toLowerCase().includes(wantArtist)) score += 30;
			else if (r.artistName && wantArtist && wantArtist.includes(r.artistName.toLowerCase())) score += 20;
			if (score > bestScore) {
				bestScore = score;
				bestId = String(r.trackId);
			}
		}
		if (!bestId || bestScore < 20) return null;
		LOG("best Apple Music ID:", bestId, "score:", bestScore);
		const mirrors = [
			`https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/am-lyrics/${bestId}.ttml`,
			`https://amll-ttml-db.stevexmh.net/am/${bestId}`,
		];
		for (const murl of mirrors) {
			try {
				LOG("fetching AMLL DB:", murl);
				const res2 = await sendBg<{ text: string }>({ type: "amll:fetch-text", url: murl });
				if (res2.text && res2.text.includes("<tt") ) {
					LOG("AMLL DB TTML found, len:", res2.text.length);
					return res2.text;
				}
			} catch (e) {
				LOG("AMLL DB mirror failed:", e);
			}
		}
		return null;
	}

	async searchLrclib(title: string, artist: string, duration: number, requireSynced: boolean): Promise<string | null> {
		const params = new URLSearchParams();
		params.set("track_name", title);
		if (artist) params.set("artist_name", artist);
		if (duration > 0) params.set("duration", String(Math.round(duration)));
		const url = `https://lrclib.net/api/search?${params.toString()}`;
		const res = await sendBg<{ json: LrclibTrack[] }>({ type: "amll:fetch-json", url });
		const hits = res.json || [];
		LOG("LRCLIB hits:", hits.length, "| requireSynced:", requireSynced);
		if (hits.length === 0) return null;
		const best = pickBestLrclibHit(hits, { title, artist, id: "", cover: "" }, duration);
		if (!best) return null;
		if (requireSynced && !best.syncedLyrics) return null;
		return best.syncedLyrics || best.plainLyrics || null;
	}

	manualSearch() {
		if (!this.currentSong) {
			LOG("manualSearch: no current song");
			return;
		}
		LOG("manualSearch: forcing search for", this.currentSong.title);
		const key = lyricStorageKey(this.currentSong);
		this.currentLines = null;
		this.lyricLoadToken++;
		lastSongTitle = "";
		void chrome.storage.local.remove(key, () => {
			void this.autoSearchLyric(this.currentSong!);
		});
	}

	seekTo(seconds: number) {
		const v = getVideo();
		if (v) {
			try {
				v.currentTime = seconds;
				this.player.resetScroll();
			} catch {}
		}
	}

	startRaf() {
		const loop = (t: number) => {
			if (this.lastFrame === 0) this.lastFrame = t;
			const delta = t - this.lastFrame;
			this.lastFrame = t;
			if (this.mounted && this.enabled) {
				const v = getVideo();
				if (v) {
					this.player.setCurrentTime(v.currentTime * 1000);
				}
				this.player.update(delta);
			}
			this.rafId = requestAnimationFrame(loop);
		};
		this.rafId = requestAnimationFrame(loop);
	}
}

function escapeHtml(s: string) {
	return s.replace(
		/[&<>"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
	);
}

function lyricStorageKey(song: SongInfo) {
	const cleanTitle = song.title.replace(/\s*[（(].*$/, "").trim() || song.title;
	return `amll:lyric:${song.id}:${cleanTitle}`;
}

function getVideo(): HTMLVideoElement | null {
	return (
		document.querySelector<HTMLVideoElement>("ytmusic-player video") ||
		document.querySelector<HTMLVideoElement>("#movie_player video") ||
		document.querySelector<HTMLVideoElement>("video")
	);
}

function queryText(el: Element | null): string {
	if (!el) return "";
	return (el.textContent || "").trim();
}

function getCurrentSongInfo(): SongInfo | null {
	const info: Partial<SongInfo> = {};

	// 1) 队列中选中/播放中的项
	try {
		const queueItem = document.querySelector(
			"ytmusic-player-queue-item[selected], ytmusic-player-queue-item[play-button-state='playing'], ytmusic-player-queue-item.playing",
		);
		if (queueItem) {
			if (LOG_VERBOSE) LOG("song: stage1 queueItem found");
			const t = queueItem.querySelector(".title, yt-formatted-string.title, [title]");
			info.title = queryText(t) || (t?.getAttribute("title") ?? "") || "";
			const a = queueItem.querySelector(".byline, yt-formatted-string.subtitle, .subtitle");
			info.artist = queryText(a);
			const c = queueItem.querySelector<HTMLImageElement>("yt-img-shadow img, img");
			info.cover = c?.src || "";
			if (LOG_VERBOSE) LOG("song: stage1 title=", info.title, "artist=", info.artist);
		}
	} catch (e) {
		LOG("song: stage1 error", e);
	}

	// 2) 播放器页面主标题
	if (!info.title) {
		try {
			const page = document.querySelector("ytmusic-player-page, ytmusic-player");
			const t2 = page?.querySelector(".title, yt-formatted-string.title, .content-info-title, [title]");
			info.title = queryText(t2) || (t2?.getAttribute("title") ?? "") || "";
			const a2 = page?.querySelector(
				".byline, yt-formatted-string.subtitle, .subtitle, .content-info-subtitle",
			);
			info.artist = queryText(a2);
			const c2 = page?.querySelector<HTMLImageElement>("#song-image img, yt-img-shadow img, img");
			info.cover = c2?.src || info.cover;
			if (LOG_VERBOSE) LOG("song: stage2 title=", info.title, "artist=", info.artist);
		} catch (e) {
			LOG("song: stage2 error", e);
		}
	}

	// 3) 底部播放器栏
	if (!info.title) {
		try {
			const bar = document.querySelector("ytmusic-player-bar");
			const t3 = bar?.querySelector(".title, yt-formatted-string.title, .content-info-title");
			info.title = queryText(t3);
			const a3 = bar?.querySelector(".byline, yt-formatted-string.subtitle, .subtitle");
			info.artist = queryText(a3);
			if (LOG_VERBOSE) LOG("song: stage3 title=", info.title, "artist=", info.artist);
		} catch (e) {
			LOG("song: stage3 error", e);
		}
	}

	// 4) document.title
	if (!info.title) {
		try {
			const dt = document.title.replace(/\s*[-|]\s*YouTube Music\s*$/, "").trim();
			if (dt && dt.toLowerCase() !== "youtube music") info.title = dt;
			if (LOG_VERBOSE) LOG("song: stage4 docTitle=", info.title, "| raw=", document.title);
		} catch (e) {
			LOG("song: stage4 error", e);
		}
	}

	// id
	let id = "";
	try {
		id =
			new URLSearchParams(location.search).get("v") ||
			new URLSearchParams(location.search).get("videoId") ||
			"";
	} catch {}
	if (!id) {
		try {
			const queueItem = document.querySelector(
				"ytmusic-player-queue-item[selected], ytmusic-player-queue-item[play-button-state='playing']",
			);
			if (queueItem) {
				id =
					queueItem.getAttribute("video-id") ||
					queueItem.querySelector("[video-id]")?.getAttribute("video-id") ||
					"";
			}
		} catch {}
	}
	if (!id) id = `${info.title}__${info.artist}`;

	const title = (info.title || "").trim();
	if (!title) {
		LOG("getCurrentSongInfo: no title found");
		return null;
	}
	const song: SongInfo = {
		id: id.trim(),
		title,
		artist: (info.artist || "").trim(),
		cover: info.cover || "",
	};
	return song;
}

function isLyricsTabActive(): boolean {
	const selectedTab = document.querySelector(
		"tp-yt-paper-tab.iron-selected",
	);
	const tabText = (selectedTab?.textContent || "").trim();
	if (selectedTab && /歌词|lyric/i.test(tabText)) {
		return true;
	}
	const shelf = document.querySelector(
		"ytmusic-description-shelf-renderer[is-track-lyrics-page]",
	);
	if (shelf) {
		const rect = shelf.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) return true;
	}
	return false;
}

function getLyricsMountTarget(): HTMLElement | null {
	const shelf = document.querySelector<HTMLElement>(
		"ytmusic-description-shelf-renderer[is-track-lyrics-page]",
	);
	if (shelf) {
		const wrapper = shelf.querySelector<HTMLElement>(".wrapper");
		return wrapper || shelf;
	}

	// Diagnostic: dump what's actually in the lyrics tab
	const tabRenderer = document.querySelector<HTMLElement>(
		"ytmusic-tab-renderer#tab-renderer",
	);
	if (tabRenderer) {
		const allShelves = tabRenderer.querySelectorAll("*");
		const tagNames = new Set<string>();
		for (const el of allShelves) {
			tagNames.add(el.tagName.toLowerCase());
		}
		LOG("diag: no is-track-lyrics-page shelf found. tab-renderer children tags:", [...tagNames].join(", "));
		// Look for any description shelf or lyrics-related element
		const anyShelf = tabRenderer.querySelector<HTMLElement>("ytmusic-description-shelf-renderer");
		if (anyShelf) {
			LOG("diag: found ytmusic-description-shelf-renderer without is-track-lyrics-page attr");
			const wrapper = anyShelf.querySelector<HTMLElement>(".wrapper");
			return wrapper || anyShelf;
		}
		// Look for content-scroller or ytmusic-message-renderer
		const scroller = tabRenderer.querySelector<HTMLElement>("#content-scroller, .content-scroller");
		if (scroller) {
			LOG("diag: found content-scroller");
			return scroller;
		}
		// Last resort: the tab renderer itself, but NOT the queue scroller
		LOG("diag: falling back to tab-renderer itself");
		return tabRenderer;
	}
	return null;
}

function hideNativeLyrics(hide: boolean) {
	const shelf = document.querySelector(
		"ytmusic-description-shelf-renderer[is-track-lyrics-page]",
	);
	if (!shelf) return;
	shelf.classList.toggle("amll-native-hidden", hide);
}

let controller: AMLLController;
let lastSongId = "";
let lastSongTitle = "";
let lastLyricsActive = false;

function init() {
	injectStyles();
	controller = new AMLLController();
	void chrome.storage.local.get(null, (all) => {
		const keysToRemove = Object.keys(all).filter((k) =>
			k.startsWith("amll:lyric:") || k === "amll:enabled" || k === "amll:toolbar-hidden",
		);
		if (keysToRemove.length > 0) {
			void chrome.storage.local.remove(keysToRemove, () => {
				LOG("cleared", keysToRemove.length, "old cache entries");
			});
		}
	});
	controller.setEnabled(true);
	controller.setToolbarHidden(false);
	observePage();
	setInterval(tick, 1500);
	setTimeout(() => { tick(); }, 3000);
	LOG("initialized");
}

function observePage() {
	const body = document.body;
	const observer = new MutationObserver(() => {
		tick();
	});
	observer.observe(body, {
		childList: true,
		subtree: true,
		attributes: true,
		characterData: true,
	});
	tick();
}

let lastDiagTs = 0;
function diag() {
	if (!LOG_VERBOSE) return;
	const now = Date.now();
	if (now - lastDiagTs < 5000) return;
	lastDiagTs = now;
	const selTab = document.querySelector("tp-yt-paper-tab.iron-selected");
	const tabs = Array.from(
		document.querySelectorAll("tp-yt-paper-tab"),
	).map((t) => (t.textContent || "").trim());
	const shelf = document.querySelector(
		"ytmusic-description-shelf-renderer[is-track-lyrics-page]",
	);
	const tabRenderer = document.querySelector(
		"ytmusic-tab-renderer#tab-renderer",
	);
	LOG(
		"diag: selTab=",
		selTab ? (selTab.textContent || "").trim() : null,
		"tabs=",
		tabs,
		"shelf=",
		!!shelf,
		"tabRenderer=",
		!!tabRenderer,
		"pageType=",
		tabRenderer?.getAttribute("page-type"),
	);
}

function tick() {
	diag();
	try {
		const song = getCurrentSongInfo();
		if (song && (song.id !== lastSongId || song.title !== lastSongTitle)) {
			lastSongId = song.id;
			lastSongTitle = song.title;
			LOG("song detected:", song.title, "|", song.artist, "|", song.id);
			controller.setSong(song);
		}
	} catch (e) {
		LOG("ERROR in getCurrentSongInfo:", e);
	}
	try {
		const active = isLyricsTabActive();
		if (active) {
			if (!controller.mounted || !controller.root.isConnected) {
				if (controller.mounted) controller.unmount();
				const target = getLyricsMountTarget();
				if (target) {
					controller.mount(target);
					hideNativeLyrics(controller.enabled);
					LOG("mounted, enabled=", controller.enabled);
				}
			} else {
				hideNativeLyrics(controller.enabled);
			}
		} else if (controller.mounted) {
			controller.unmount();
			hideNativeLyrics(false);
		}
		lastLyricsActive = active;
	} catch (e) {
		LOG("ERROR in tick lyrics:", e);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
