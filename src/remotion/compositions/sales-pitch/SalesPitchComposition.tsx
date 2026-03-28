import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useEffect, useRef, useState } from "react";
import {
	Audio,
	AbsoluteFill,
	Img,
	continueRender,
	delayRender,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import {
	SALES_PITCH_CAPTION_CUES,
	SALES_PITCH_FOOTAGE_CUES,
	SALES_PITCH_NARRATION_LINES,
	SALES_PITCH_SCENE_BEATS,
	SALES_PITCH_SCENE_DURATIONS,
	SALES_PITCH_TOTAL_FRAMES,
	SALES_PITCH_TRANSITION_FRAMES,
} from "@/remotion/compositions/sales-pitch/sales-pitch.data";
import {
	ApprovalScene,
	ClosingScene,
	GroundingScene,
	MerchantOverviewScene,
	ProblemOpenScene,
	ShopperAssistantScene,
	TrustScene,
} from "@/remotion/compositions/sales-pitch/sales-pitch.scenes";
import type {
	CaptionCue,
	FootageCue,
	SalesPitchCompositionProps,
	SalesPitchFootageMode,
	SceneBeat,
} from "@/remotion/compositions/sales-pitch/sales-pitch.types";

const frameBackground = "linear-gradient(180deg, #eef4fb 0%, #f8fafc 48%, #eef2f7 100%)";
const NARRATION_MASTER_AUDIO_SRC = "remotion/audio/storeai-sales-pitch-voiceover.wav";

const FOOTAGE_BY_ID: Record<string, FootageCue> = Object.fromEntries(
	SALES_PITCH_FOOTAGE_CUES.map((cue) => [cue.id, cue]),
);

async function assetExists(src: string) {
	const url = staticFile(src);

	try {
		const headResponse = await fetch(url, {
			method: "HEAD",
		});

		if (headResponse.ok) {
			return true;
		}
	} catch {}

	try {
		const getResponse = await fetch(url, {
			cache: "no-store",
			method: "GET",
		});
		return getResponse.ok;
	} catch {
		return false;
	}
}

function createAvailabilityMap(cues: FootageCue[], defaultValue: boolean): Record<string, boolean> {
	return Object.fromEntries(cues.map((cue) => [cue.id, defaultValue]));
}

function useFootageAvailability(mode: SalesPitchFootageMode) {
	const [handle] = useState(() =>
		mode === "auto" ? delayRender("storeai-remotion-footage-check") : null,
	);
	const continueOnceRef = useRef(false);
	const [availability, setAvailability] = useState<Record<string, boolean>>(() =>
		createAvailabilityMap(SALES_PITCH_FOOTAGE_CUES, mode === "footage"),
	);

	useEffect(() => {
		if (mode === "placeholder") {
			setAvailability(createAvailabilityMap(SALES_PITCH_FOOTAGE_CUES, false));
			return;
		}

		if (mode === "footage") {
			setAvailability(createAvailabilityMap(SALES_PITCH_FOOTAGE_CUES, true));
			return;
		}

		if (handle === null) {
			return;
		}

		let cancelled = false;

		const continueIfNeeded = () => {
			if (continueOnceRef.current) {
				return;
			}

			continueOnceRef.current = true;
			continueRender(handle);
		};

		void Promise.all(
			SALES_PITCH_FOOTAGE_CUES.map(async (cue) => {
				return [cue.id, await assetExists(cue.src)] as const;
			}),
		)
			.then((entries) => {
				if (!cancelled) {
					setAvailability(Object.fromEntries(entries));
				}
			})
			.finally(() => {
				continueIfNeeded();
			});

		return () => {
			cancelled = true;
			continueIfNeeded();
		};
	}, [handle, mode]);

	return availability;
}

function useNarrationAvailability() {
	const [handle] = useState(() => delayRender("storeai-remotion-narration-check"));
	const continueOnceRef = useRef(false);
	const [isAvailable, setIsAvailable] = useState(false);

	useEffect(() => {
		let cancelled = false;

		const continueIfNeeded = () => {
			if (continueOnceRef.current) {
				return;
			}

			continueOnceRef.current = true;
			continueRender(handle);
		};

		void assetExists(NARRATION_MASTER_AUDIO_SRC)
			.then((available) => {
				if (!cancelled) {
					setIsAvailable(available);
				}
			})
			.finally(() => {
				continueIfNeeded();
			});

		return () => {
			cancelled = true;
			continueIfNeeded();
		};
	}, [handle]);

	return isAvailable;
}

function getActiveCaption(frame: number) {
	return (
		SALES_PITCH_CAPTION_CUES.find(
			(caption) => frame >= caption.startFrame && frame < caption.endFrame,
		) ?? null
	);
}

function BrandChrome({ brandLabel }: { brandLabel: string }) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const reveal = spring({
		config: {
			damping: 200,
			stiffness: 160,
		},
		fps,
		frame,
	});
	const progress = frame / Math.max(SALES_PITCH_TOTAL_FRAMES - 1, 1);

	return (
		<div
			style={{
				inset: "28px 48px auto",
				position: "absolute",
				zIndex: 20,
			}}
		>
			<div
				style={{
					alignItems: "center",
					backdropFilter: "blur(10px)",
					background: "rgba(255, 255, 255, 0.72)",
					border: "1px solid rgba(15, 23, 42, 0.06)",
					borderRadius: 999,
					boxShadow: "0 8px 32px rgba(15, 23, 42, 0.06)",
					display: "grid",
					gap: 14,
					gridTemplateColumns: "auto auto minmax(0, 1fr)",
					opacity: interpolate(reveal, [0, 1], [0, 1]),
					padding: "8px 20px 8px 8px",
					transform: `translateY(${interpolate(reveal, [0, 1], [-16, 0])}px)`,
				}}
			>
				<div
					style={{
						alignItems: "center",
						background: "linear-gradient(135deg, #111827 0%, #334155 100%)",
						borderRadius: 12,
						display: "flex",
						height: 32,
						justifyContent: "center",
						width: 32,
					}}
				>
					<Img
						src={staticFile("icon-moonbeam.svg")}
						style={{
							height: 18,
							width: 18,
						}}
					/>
				</div>
				<div
					style={{
						color: "#09090b",
						fontFamily:
							'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
						fontSize: 16,
						fontWeight: 700,
						letterSpacing: "-0.02em",
					}}
				>
					{brandLabel}
				</div>
				<div
					style={{
						background: "rgba(15, 23, 42, 0.06)",
						borderRadius: 999,
						height: 3,
						overflow: "hidden",
					}}
				>
					<div
						style={{
							background: "linear-gradient(90deg, #0f172a 0%, #2563eb 100%)",
							borderRadius: 999,
							height: "100%",
							transition: "width 0.1s ease-out",
							width: `${progress * 100}%`,
						}}
					/>
				</div>
			</div>
		</div>
	);
}

function CaptionRail({ cue }: { cue: CaptionCue | null }) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const reveal = spring({
		config: {
			damping: 200,
			stiffness: 160,
		},
		fps,
		frame: cue ? Math.max(frame - cue.startFrame, 0) : 0,
	});

	if (!cue) {
		return null;
	}

	return (
		<div
			style={{
				bottom: 36,
				display: "flex",
				justifyContent: "center",
				left: 48,
				position: "absolute",
				right: 48,
				zIndex: 24,
			}}
		>
			<div
				style={{
					backdropFilter: "blur(16px)",
					background: "rgba(8, 13, 23, 0.68)",
					border: "1px solid rgba(255, 255, 255, 0.06)",
					borderRadius: 24,
					boxShadow: "0 16px 48px rgba(15, 23, 42, 0.18)",
					display: "grid",
					gap: 4,
					maxWidth: 1100,
					opacity: interpolate(reveal, [0, 1], [0, 1]),
					padding: "18px 28px",
					textAlign: "center",
					transform: `translateY(${interpolate(reveal, [0, 1], [12, 0])}px)`,
				}}
			>
				{cue.lines.map((line) => (
					<div
						key={line}
						style={{
							color: "white",
							fontFamily:
								'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
							fontSize: 28,
							fontWeight: 600,
							letterSpacing: "-0.02em",
							lineHeight: 1.18,
						}}
					>
						{line}
					</div>
				))}
			</div>
		</div>
	);
}

function BackgroundWash() {
	const frame = useCurrentFrame();
	const shopperOrbX = interpolate(frame, [0, SALES_PITCH_TOTAL_FRAMES], [-80, 220]);
	const merchantOrbX = interpolate(frame, [0, SALES_PITCH_TOTAL_FRAMES], [140, -160]);

	return (
		<>
			<AbsoluteFill
				style={{
					background: frameBackground,
				}}
			/>
			<div
				style={{
					background:
						"radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0) 70%)",
					borderRadius: 9999,
					filter: "blur(14px)",
					height: 620,
					left: shopperOrbX,
					position: "absolute",
					top: 110,
					width: 620,
				}}
			/>
			<div
				style={{
					background: "radial-gradient(circle, rgba(15, 23, 42, 0.08) 0%, rgba(15, 23, 42, 0) 70%)",
					borderRadius: 9999,
					bottom: -120,
					filter: "blur(16px)",
					height: 760,
					position: "absolute",
					right: merchantOrbX,
					width: 760,
				}}
			/>
		</>
	);
}

function VoiceoverTrack({ isAvailable }: { isAvailable: boolean }) {
	if (!isAvailable || SALES_PITCH_NARRATION_LINES.length === 0) {
		return null;
	}

	return <Audio src={staticFile(NARRATION_MASTER_AUDIO_SRC)} />;
}

function GuideOverlay() {
	return (
		<>
			<div
				style={{
					border: "2px dashed rgba(37, 99, 235, 0.22)",
					inset: "96px 96px 160px",
					position: "absolute",
				}}
			/>
			<div
				style={{
					border: "2px dashed rgba(15, 23, 42, 0.12)",
					inset: "132px 132px 198px",
					position: "absolute",
				}}
			/>
		</>
	);
}

function SceneRenderer({
	activeBeat,
	brandLabel,
	footageAvailability,
	footageById,
	footageMode,
	subtitleLabel,
}: {
	activeBeat: SceneBeat;
	brandLabel: string;
	footageAvailability: Record<string, boolean>;
	footageById: Record<string, FootageCue>;
	footageMode: SalesPitchFootageMode;
	subtitleLabel: string;
}) {
	switch (activeBeat.id) {
		case "problem-open":
			return (
				<ProblemOpenScene
					beat={activeBeat}
					brandLabel={brandLabel}
					footageAvailability={footageAvailability}
					footageById={footageById}
					footageMode={footageMode}
					subtitleLabel={subtitleLabel}
				/>
			);
		case "shopper-assistant":
			return (
				<ShopperAssistantScene
					beat={activeBeat}
					brandLabel={brandLabel}
					footageAvailability={footageAvailability}
					footageById={footageById}
					footageMode={footageMode}
					subtitleLabel={subtitleLabel}
				/>
			);
		case "trust":
			return (
				<TrustScene
					beat={activeBeat}
					brandLabel={brandLabel}
					footageAvailability={footageAvailability}
					footageById={footageById}
					footageMode={footageMode}
					subtitleLabel={subtitleLabel}
				/>
			);
		case "merchant-overview":
			return (
				<MerchantOverviewScene
					beat={activeBeat}
					brandLabel={brandLabel}
					footageAvailability={footageAvailability}
					footageById={footageById}
					footageMode={footageMode}
					subtitleLabel={subtitleLabel}
				/>
			);
		case "approval":
			return (
				<ApprovalScene
					beat={activeBeat}
					brandLabel={brandLabel}
					footageAvailability={footageAvailability}
					footageById={footageById}
					footageMode={footageMode}
					subtitleLabel={subtitleLabel}
				/>
			);
		case "grounding":
			return (
				<GroundingScene
					beat={activeBeat}
					brandLabel={brandLabel}
					footageAvailability={footageAvailability}
					footageById={footageById}
					footageMode={footageMode}
					subtitleLabel={subtitleLabel}
				/>
			);
		case "closing":
			return (
				<ClosingScene
					beat={activeBeat}
					brandLabel={brandLabel}
					footageAvailability={footageAvailability}
					footageById={footageById}
					footageMode={footageMode}
					subtitleLabel={subtitleLabel}
				/>
			);
	}

	return null;
}

export function SalesPitchComposition({
	brandLabel = "StoreAI",
	footageMode = "auto",
	showGuides = false,
	showSubtitles = true,
	subtitleLabel = "Shopify AI Console",
}: SalesPitchCompositionProps) {
	const frame = useCurrentFrame();
	const activeCaption = getActiveCaption(frame);
	const footageAvailability = useFootageAvailability(footageMode);
	const narrationAvailable = useNarrationAvailability();

	const transitionTiming = springTiming({
		config: { damping: 200 },
		durationInFrames: SALES_PITCH_TRANSITION_FRAMES,
	});

	return (
		<AbsoluteFill
			style={{
				background: frameBackground,
				color: "#09090b",
				overflow: "hidden",
			}}
		>
			<BackgroundWash />
			<VoiceoverTrack isAvailable={narrationAvailable} />
			<BrandChrome brandLabel={brandLabel} />
			<TransitionSeries>
				{SALES_PITCH_SCENE_BEATS.flatMap((beat, i) => {
					const duration = SALES_PITCH_SCENE_DURATIONS[i];
					const elements = [
						<TransitionSeries.Sequence durationInFrames={duration} key={beat.id}>
							<SceneRenderer
								activeBeat={beat}
								brandLabel={brandLabel}
								footageAvailability={footageAvailability}
								footageById={FOOTAGE_BY_ID}
								footageMode={footageMode}
								subtitleLabel={subtitleLabel}
							/>
						</TransitionSeries.Sequence>,
					];
					if (i < SALES_PITCH_SCENE_BEATS.length - 1) {
						elements.push(
							<TransitionSeries.Transition
								key={`transition-${beat.id}`}
								presentation={fade()}
								timing={transitionTiming}
							/>,
						);
					}
					return elements;
				})}
			</TransitionSeries>
			{showSubtitles ? <CaptionRail cue={activeCaption} /> : null}
			{showGuides ? <GuideOverlay /> : null}
		</AbsoluteFill>
	);
}
