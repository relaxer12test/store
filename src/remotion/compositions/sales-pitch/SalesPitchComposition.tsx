import { useEffect, useRef, useState } from "react";
import {
	AbsoluteFill,
	Img,
	Sequence,
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
	SALES_PITCH_SCENE_BEATS,
	SALES_PITCH_TOTAL_FRAMES,
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

function getActiveBeat(frame: number) {
	return (
		SALES_PITCH_SCENE_BEATS.find((beat) => frame >= beat.startFrame && frame < beat.endFrame) ??
		SALES_PITCH_SCENE_BEATS[SALES_PITCH_SCENE_BEATS.length - 1]
	);
}

function getActiveCaption(frame: number) {
	return (
		SALES_PITCH_CAPTION_CUES.find(
			(caption) => frame >= caption.startFrame && frame < caption.endFrame,
		) ?? null
	);
}

function BrandChrome({
	activeBeat,
	brandLabel,
	subtitleLabel,
}: {
	activeBeat: SceneBeat;
	brandLabel: string;
	subtitleLabel: string;
}) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const reveal = spring({
		config: {
			damping: 200,
			stiffness: 180,
		},
		fps,
		frame,
	});
	const progress = frame / Math.max(SALES_PITCH_TOTAL_FRAMES - 1, 1);

	return (
		<div
			style={{
				inset: "34px 48px auto",
				position: "absolute",
				zIndex: 20,
			}}
		>
			<div
				style={{
					alignItems: "center",
					backdropFilter: "blur(14px)",
					background: "rgba(255, 255, 255, 0.8)",
					border: "1px solid rgba(15, 23, 42, 0.07)",
					borderRadius: 999,
					boxShadow: "0 20px 42px rgba(15, 23, 42, 0.08)",
					display: "grid",
					gap: 22,
					gridTemplateColumns: "auto auto minmax(0, 1fr) auto",
					padding: "14px 18px 14px 14px",
					transform: `translateY(${interpolate(reveal, [0, 1], [-28, 0])}px)`,
				}}
			>
				<div
					style={{
						alignItems: "center",
						background: "linear-gradient(135deg, #111827 0%, #334155 100%)",
						borderRadius: 18,
						display: "flex",
						height: 54,
						justifyContent: "center",
						width: 54,
					}}
				>
					<Img
						src={staticFile("icon-moonbeam.svg")}
						style={{
							height: 30,
							width: 30,
						}}
					/>
				</div>
				<div
					style={{
						display: "grid",
						gap: 4,
						minWidth: 0,
					}}
				>
					<div
						style={{
							color: "#09090b",
							fontFamily:
								'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
							fontSize: 20,
							fontWeight: 700,
							letterSpacing: "-0.03em",
						}}
					>
						{brandLabel}
					</div>
					<div
						style={{
							color: "#52525b",
							fontFamily:
								'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
							fontSize: 15,
							fontWeight: 600,
						}}
					>
						{subtitleLabel}
					</div>
				</div>
				<div
					style={{
						alignItems: "center",
						display: "grid",
						gap: 8,
						gridTemplateColumns: "1fr",
						minWidth: 260,
					}}
				>
					<div
						style={{
							alignItems: "center",
							display: "flex",
							justifyContent: "space-between",
						}}
					>
						<div
							style={{
								color: "#52525b",
								fontFamily:
									'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
								fontSize: 13,
								fontWeight: 700,
								letterSpacing: "0.12em",
								textTransform: "uppercase",
							}}
						>
							{activeBeat.eyebrow}
						</div>
						<div
							style={{
								color: "#09090b",
								fontFamily:
									'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
								fontSize: 14,
								fontWeight: 700,
							}}
						>
							{Math.round(progress * 100)}%
						</div>
					</div>
					<div
						style={{
							background: "rgba(15, 23, 42, 0.08)",
							borderRadius: 999,
							height: 8,
							overflow: "hidden",
							position: "relative",
						}}
					>
						<div
							style={{
								background: "linear-gradient(90deg, #0f172a 0%, #2563eb 100%)",
								borderRadius: 999,
								height: "100%",
								width: `${progress * 100}%`,
							}}
						/>
					</div>
				</div>
				<div
					style={{
						background: "rgba(15, 23, 42, 0.08)",
						borderRadius: 999,
						color: "#09090b",
						fontFamily:
							'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
						fontSize: 15,
						fontWeight: 700,
						padding: "12px 16px",
						textTransform: "capitalize",
					}}
				>
					{activeBeat.audience}
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
			stiffness: 180,
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
					backdropFilter: "blur(18px)",
					background: "rgba(8, 13, 23, 0.78)",
					border: "1px solid rgba(255, 255, 255, 0.08)",
					borderRadius: 32,
					boxShadow: "0 24px 64px rgba(15, 23, 42, 0.22)",
					display: "grid",
					gap: 6,
					maxWidth: 1180,
					padding: "22px 30px",
					textAlign: "center",
					transform: `translateY(${interpolate(reveal, [0, 1], [18, 0])}px)`,
				}}
			>
				{cue.lines.map((line) => (
					<div
						key={line}
						style={{
							color: "white",
							fontFamily:
								'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
							fontSize: 31,
							fontWeight: 600,
							letterSpacing: "-0.03em",
							lineHeight: 1.12,
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
						"radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(37, 99, 235, 0) 70%)",
					borderRadius: 9999,
					filter: "blur(8px)",
					height: 620,
					left: shopperOrbX,
					position: "absolute",
					top: 110,
					width: 620,
				}}
			/>
			<div
				style={{
					background: "radial-gradient(circle, rgba(15, 23, 42, 0.12) 0%, rgba(15, 23, 42, 0) 70%)",
					borderRadius: 9999,
					bottom: -120,
					filter: "blur(12px)",
					height: 760,
					position: "absolute",
					right: merchantOrbX,
					width: 760,
				}}
			/>
		</>
	);
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
	subtitleLabel = "Shopify AI Console",
}: SalesPitchCompositionProps) {
	const frame = useCurrentFrame();
	const activeBeat = getActiveBeat(frame);
	const activeCaption = getActiveCaption(frame);
	const footageAvailability = useFootageAvailability(footageMode);

	return (
		<AbsoluteFill
			style={{
				background: frameBackground,
				color: "#09090b",
				overflow: "hidden",
			}}
		>
			<BackgroundWash />
			<BrandChrome activeBeat={activeBeat} brandLabel={brandLabel} subtitleLabel={subtitleLabel} />
			{SALES_PITCH_SCENE_BEATS.map((beat) => (
				<Sequence
					durationInFrames={beat.endFrame - beat.startFrame}
					from={beat.startFrame}
					key={beat.id}
				>
					<SceneRenderer
						activeBeat={beat}
						brandLabel={brandLabel}
						footageAvailability={footageAvailability}
						footageById={FOOTAGE_BY_ID}
						footageMode={footageMode}
						subtitleLabel={subtitleLabel}
					/>
				</Sequence>
			))}
			<CaptionRail cue={activeCaption} />
			{showGuides ? <GuideOverlay /> : null}
		</AbsoluteFill>
	);
}
