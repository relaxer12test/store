import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const fps = 30;
const rootDir = process.cwd();
const tempDir = path.resolve(rootDir, ".cache/remotion-audio");
const rawDir = path.join(tempDir, "raw");
const concatDir = path.join(tempDir, "concat");
const metadataPath = path.join(tempDir, "voice-engine.txt");
const linesManifestPath = path.join(tempDir, "narration-lines.json");
const audioDir = path.resolve(rootDir, "public/remotion/audio");
const lineDir = path.join(audioDir, "narration");
const masterOutputPath = path.join(audioDir, "storeai-sales-pitch-voiceover.wav");
const pythonScriptPath = path.resolve(
	rootDir,
	"scripts/generate_sales_pitch_voiceover_chatterbox.py",
);
const pythonBinary = process.env.CHATTERBOX_PYTHON ?? "/opt/homebrew/bin/python3.11";
const venvDir = path.resolve(rootDir, ".cache/chatterbox-venv");
const venvPython = path.join(venvDir, "bin/python");
const uvBinary = process.env.UV_BIN ?? "uv";
const chatterboxEngineId = "chatterbox-tts-0.1.7:setuptools<81";
const forceRevoice = process.env.FORCE_REVOICE === "true";
const chatterboxDevice = process.env.CHATTERBOX_DEVICE ?? "mps";
const chatterboxExaggeration = process.env.CHATTERBOX_EXAGGERATION ?? "0.55";
const chatterboxCfgWeight = process.env.CHATTERBOX_CFG_WEIGHT ?? "0.45";

const narrationLines = [
	{
		endFrame: toFrames(2.8),
		id: "line-01",
		startFrame: toFrames(0),
		text: "Shopping should feel guided, not abandoned.",
	},
	{
		endFrame: toFrames(6),
		id: "line-02",
		startFrame: toFrames(2.8),
		text: "Selling should feel controlled, not chaotic.",
	},
	{
		endFrame: toFrames(10.5),
		id: "line-03",
		startFrame: toFrames(6),
		text: "StoreAI meets the shopper in the storefront with safe, relevant recommendations.",
	},
	{
		endFrame: toFrames(16),
		id: "line-04",
		startFrame: toFrames(10.5),
		text: "It compares options, answers policy questions, and turns intent into a cart plan.",
	},
	{
		endFrame: toFrames(20),
		id: "line-05",
		startFrame: toFrames(16),
		text: "Helpful for the shopper, grounded in what the store can actually sell.",
	},
	{
		endFrame: toFrames(24),
		id: "line-06",
		startFrame: toFrames(20),
		text: "When someone asks for a hidden discount or a freebie, the assistant refuses.",
	},
	{
		endFrame: toFrames(28),
		id: "line-07",
		startFrame: toFrames(24),
		text: "Trust is part of the product, not a cleanup step after launch.",
	},
	{
		endFrame: toFrames(34),
		id: "line-08",
		startFrame: toFrames(28),
		text: "Inside Shopify admin, the merchant sees dashboards, pending approvals, and recent workflows.",
	},
	{
		endFrame: toFrames(42),
		id: "line-09",
		startFrame: toFrames(34),
		text: "The AI can assist the work without hiding what changed, what is queued, or what needs review.",
	},
	{
		endFrame: toFrames(49),
		id: "line-10",
		startFrame: toFrames(42),
		text: "Inside the merchant app, the copilot can reason over uploaded playbooks and live store context.",
	},
	{
		endFrame: toFrames(56),
		id: "line-11",
		startFrame: toFrames(49),
		text: "That guidance stays visible in the workflow-aware shell, so the next step stays grounded and reviewable.",
	},
	{
		endFrame: toFrames(62),
		id: "line-12",
		startFrame: toFrames(56),
		text: "Knowledge stays audience-aware: public policy helps shoppers, private SOPs stay merchant-only.",
	},
	{
		endFrame: toFrames(67),
		id: "line-13",
		startFrame: toFrames(62),
		text: "That means faster answers without exposing the wrong information to the wrong surface.",
	},
	{
		endFrame: toFrames(75),
		id: "line-14",
		startFrame: toFrames(67),
		text: "StoreAI brings shopper assistance and merchant control into one accountable AI system.",
	},
];

function toFrames(seconds) {
	return Math.round(seconds * fps);
}

function ensureDir(dirPath) {
	mkdirSync(dirPath, {
		recursive: true,
	});
}

async function getAudioDurationSeconds(filePath) {
	const { stdout } = await execFileAsync("/opt/homebrew/bin/ffprobe", [
		"-v",
		"error",
		"-show_entries",
		"format=duration",
		"-of",
		"default=noprint_wrappers=1:nokey=1",
		filePath,
	]);

	const parsed = Number.parseFloat(stdout.trim());

	if (!Number.isFinite(parsed)) {
		throw new Error(`Could not determine duration for ${filePath}`);
	}

	return parsed;
}

function buildAtempoFilterChain(speedFactor) {
	if (!(speedFactor > 0)) {
		throw new Error(`Invalid atempo speed factor: ${speedFactor}`);
	}

	const filters = [];
	let remainder = speedFactor;

	while (remainder > 2) {
		filters.push("atempo=2");
		remainder /= 2;
	}

	while (remainder < 0.5) {
		filters.push("atempo=0.5");
		remainder /= 0.5;
	}

	filters.push(`atempo=${remainder.toFixed(5)}`);
	return filters;
}

async function ensureVenv() {
	if (!existsSync(venvPython)) {
		await execFileAsync(uvBinary, ["venv", venvDir, "--python", pythonBinary], {
			cwd: rootDir,
		});
	}

	await execFileAsync(
		uvBinary,
		["pip", "install", "--python", venvPython, "chatterbox-tts", "setuptools<81"],
		{
			cwd: rootDir,
		},
	);
}

async function shouldRegenerate() {
	if (forceRevoice) {
		return true;
	}

	if (!existsSync(masterOutputPath)) {
		return true;
	}

	try {
		const previous = (await readFile(metadataPath, "utf8")).trim();
		return previous !== chatterboxEngineId;
	} catch {
		return true;
	}
}

async function generateRawNarration() {
	writeFileSync(linesManifestPath, JSON.stringify(narrationLines, null, 2));
	await execFileAsync(venvPython, [pythonScriptPath, linesManifestPath, rawDir], {
		cwd: rootDir,
		env: {
			...process.env,
			CHATTERBOX_CFG_WEIGHT: chatterboxCfgWeight,
			CHATTERBOX_DEVICE: chatterboxDevice,
			CHATTERBOX_EXAGGERATION: chatterboxExaggeration,
			PYTORCH_ENABLE_MPS_FALLBACK: "1",
		},
	});
}

async function conformLineTiming(line) {
	const targetSeconds = (line.endFrame - line.startFrame) / fps;
	const rawPath = path.join(rawDir, `${line.id}.wav`);
	const outputPath = path.join(lineDir, `${line.id}.wav`);

	await rm(outputPath, {
		force: true,
	}).catch(() => {});

	const rawDuration = await getAudioDurationSeconds(rawPath);
	const filters = [];

	if (rawDuration > targetSeconds * 1.01) {
		const speedFactor = rawDuration / targetSeconds;
		filters.push(...buildAtempoFilterChain(speedFactor));
	}

	const adjustedDuration = filters.length > 0 ? targetSeconds : rawDuration;
	const silencePad = Math.max(targetSeconds - adjustedDuration, 0) + 0.02;

	filters.push(`apad=pad_dur=${silencePad.toFixed(3)}`);
	filters.push(`atrim=0:${targetSeconds.toFixed(3)}`);

	await execFileAsync("/opt/homebrew/bin/ffmpeg", [
		"-y",
		"-i",
		rawPath,
		"-af",
		filters.join(","),
		"-ar",
		"48000",
		"-ac",
		"1",
		"-c:a",
		"pcm_s16le",
		outputPath,
	]);

	return outputPath;
}

async function buildMasterTrack(linePaths) {
	const concatListPath = path.join(concatDir, "sales-pitch-audio.txt");
	const concatList = linePaths
		.map((filePath) => `file '${filePath.replaceAll("'", "'\\''")}'`)
		.join("\n");

	writeFileSync(concatListPath, concatList);

	await execFileAsync("/opt/homebrew/bin/ffmpeg", [
		"-y",
		"-f",
		"concat",
		"-safe",
		"0",
		"-i",
		concatListPath,
		"-ar",
		"48000",
		"-ac",
		"1",
		"-c:a",
		"pcm_s16le",
		masterOutputPath,
	]);
}

async function main() {
	ensureDir(tempDir);
	ensureDir(rawDir);
	ensureDir(concatDir);
	ensureDir(audioDir);
	ensureDir(lineDir);

	await ensureVenv();

	if (await shouldRegenerate()) {
		await generateRawNarration();
		for (const line of narrationLines) {
			console.log(`timing ${line.id}`);
			await conformLineTiming(line);
		}
		await writeFile(metadataPath, `${chatterboxEngineId}\n`);
	} else {
		console.log("voiceover is already current");
	}

	const linePaths = narrationLines.map((line) => path.join(lineDir, `${line.id}.wav`));
	await buildMasterTrack(linePaths);
	console.log(`built voiceover -> ${masterOutputPath}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
