import { DomLyricPlayer } from "../src/lib/amll-core.mjs";
import type { LyricLine } from "../src/lib/amll-core.mjs";
import amllCoreCss from "../src/lib/amll-core.css";

const fontRegular = document.createElement("link");
fontRegular.rel = "stylesheet";
fontRegular.href =
	"https://s1.hdslb.com/bfs/static/jinkela/long/font/regular.css";
const fontMedium = document.createElement("link");
fontMedium.rel = "stylesheet";
fontMedium.href =
	"https://s1.hdslb.com/bfs/static/jinkela/long/font/medium.css";
document.head.appendChild(fontRegular);
document.head.appendChild(fontMedium);

const style = document.createElement("style");
style.textContent =
	amllCoreCss +
	"\n" +
	`
html,body{font-family:'HarmonyOS_Regular',sans-serif}
.amll-lyric-player{
	font-family:'HarmonyOS_Regular','HarmonyOS_Medium',system-ui,sans-serif;
	--amll-lp-font-size:max(max(4.2vh,2.1vw),14px);
}
.amll-lyric-player.dom{line-height:1.45;contain:none;overflow:visible}
._2NbXLG_lyricLineWrapper{padding-block:0.5em}
._2NbXLG_lyricLine{contain:layout style;padding-bottom:0.25em}
._2NbXLG_lyricMainLine{padding-block:1.2em 1.4em}
._2NbXLG_lyricMainLine > span,
._2NbXLG_lyricMainLine span._2NbXLG_emphasizeWrapper{
	padding-block:1em 1.25em;
	margin-block:-1em -1.25em;
}
`;
document.head.appendChild(style);

const player = new DomLyricPlayer();
player.setEnableSpring(true);
player.setEnableScale(true);
player.setEnableBlur(true);
player.setAlignAnchor("center");
document.body.appendChild(player.getElement());

function buildLine(text: string, start: number, dur: number): LyricLine {
	let t = start;
	const words = text.split("|").map((seg) => {
		const [word, d] = seg.split(",");
		const end = t + Number(d);
		const w = { word, startTime: t, endTime: end };
		t = end;
		return w;
	});
	return {
		startTime: start,
		endTime: t + 2000,
		translatedLyric: "",
		romanLyric: "",
		isBG: false,
		isDuet: false,
		words,
	};
}

const lines: LyricLine[] = [
	buildLine("Apple ,750|Music ,500|Like ,500|Ly,400|ri,500|cs ,250", 1000),
	buildLine("BG ,750|Lyrics ,1000", 2000),
	buildLine("Next ,1000|Lyrics,1000", 2500),
	buildLine("This ,400|is ,400|a ,400|demo ,500|of ,400|AMLL ,600|scrolling ,700|lyrics.,800", 6000),
	buildLine("Enjoy,500|the,500|smooth,600|spring,600|animations!,900", 11000),
];

player.setLyricLines(lines);

let last = 0;
let startTs = 0;
function loop(ts: number) {
	if (!last) {
		last = ts;
		startTs = ts;
	}
	const elapsed = (ts - startTs) % 16000;
	player.setCurrentTime(elapsed);
	player.update(ts - last);
	last = ts;
	requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
