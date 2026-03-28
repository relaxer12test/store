import type { ReactNode } from "react";
import {
	AbsoluteFill,
	OffthreadVideo,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import type {
	FootageCue,
	SalesPitchFootageMode,
	SceneBeat,
} from "@/remotion/compositions/sales-pitch/sales-pitch.types";

const storefrontAccent = "#0f172a";
const merchantAccent = "#18181b";
const trustAccent = "#2563eb";
const frameBorder = "rgba(255, 255, 255, 0.18)";
const glassBorder = "rgba(255, 255, 255, 0.12)";

export interface SalesPitchSceneProps {
	beat: SceneBeat;
	brandLabel: string;
	footageAvailability: Record<string, boolean>;
	footageById: Record<string, FootageCue>;
	footageMode: SalesPitchFootageMode;
	subtitleLabel: string;
}

function sceneEnter(frame: number, fps: number, delay = 0) {
	return spring({
		config: {
			damping: 200,
			stiffness: 180,
		},
		fps,
		frame: Math.max(frame - delay, 0),
	});
}

function Stage({ children }: { children: ReactNode }) {
	return (
		<AbsoluteFill
			style={{
				padding: "104px 64px 152px",
			}}
		>
			{children}
		</AbsoluteFill>
	);
}

function TitleStack({
	accent,
	body,
	eyebrow,
	title,
}: {
	accent: string;
	body: string;
	eyebrow: string;
	title: string;
}) {
	return (
		<div
			style={{
				display: "grid",
				gap: 18,
				maxWidth: 720,
			}}
		>
			<div
				style={{
					alignItems: "center",
					color: accent,
					display: "inline-flex",
					fontFamily:
						'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					fontSize: 16,
					fontWeight: 700,
					gap: 12,
					letterSpacing: "0.14em",
					textTransform: "uppercase",
				}}
			>
				<span
					style={{
						background: accent,
						borderRadius: 999,
						display: "inline-block",
						height: 8,
						width: 8,
					}}
				/>
				{eyebrow}
			</div>
			<h1
				style={{
					color: "white",
					fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
					fontSize: 64,
					fontWeight: 600,
					letterSpacing: "-0.05em",
					lineHeight: 0.96,
					margin: 0,
					textWrap: "balance",
				}}
			>
				{title}
			</h1>
			<p
				style={{
					color: "rgba(255, 255, 255, 0.82)",
					fontFamily:
						'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					fontSize: 25,
					lineHeight: 1.45,
					margin: 0,
				}}
			>
				{body}
			</p>
		</div>
	);
}

function CapturePlaceholder({ cue }: { cue: FootageCue }) {
	return (
		<div
			style={{
				background:
					"linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)",
				display: "grid",
				height: "100%",
				padding: "36px 40px",
			}}
		>
			<div
				style={{
					display: "grid",
					gap: 18,
					maxWidth: 720,
				}}
			>
				<div
					style={{
						color: "rgba(255, 255, 255, 0.66)",
						fontFamily:
							'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
						fontSize: 15,
						fontWeight: 700,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
					}}
				>
					Real footage slot
				</div>
				<div
					style={{
						color: "white",
						fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
						fontSize: 54,
						fontWeight: 600,
						letterSpacing: "-0.04em",
						lineHeight: 0.96,
					}}
				>
					{cue.placeholderTitle}
				</div>
				<div
					style={{
						color: "rgba(255, 255, 255, 0.84)",
						fontFamily:
							'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
						fontSize: 24,
						lineHeight: 1.45,
					}}
				>
					{cue.description}
				</div>
			</div>
			<div
				style={{
					alignSelf: "end",
					justifySelf: "start",
				}}
			>
				<div
					style={{
						background: "rgba(255, 255, 255, 0.1)",
						border: "1px solid rgba(255, 255, 255, 0.18)",
						borderRadius: 999,
						color: "white",
						fontFamily:
							'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
						fontSize: 15,
						fontWeight: 600,
						padding: "12px 18px",
					}}
				>
					/{cue.src}
				</div>
			</div>
		</div>
	);
}

function FootageCanvas({
	cue,
	isAvailable,
	mode,
}: {
	cue: FootageCue;
	isAvailable: boolean;
	mode: SalesPitchFootageMode;
}) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const reveal = sceneEnter(frame, fps);
	const y = interpolate(reveal, [0, 1], [36, 0]);
	const scale = interpolate(reveal, [0, 1], [0.985, 1]);
	const showFootage = mode !== "placeholder" && isAvailable;

	return (
		<div
			style={{
				background: "#0f172a",
				border: `1px solid ${frameBorder}`,
				borderRadius: 36,
				boxShadow: "0 28px 80px rgba(15, 23, 42, 0.22)",
				height: "100%",
				overflow: "hidden",
				position: "relative",
				transform: `translateY(${y}px) scale(${scale})`,
			}}
		>
			{showFootage ? (
				<OffthreadVideo
					muted
					src={staticFile(cue.src)}
					style={{
						height: "100%",
						objectFit: "cover",
						width: "100%",
					}}
					trimBefore={cue.trimBeforeFrames}
				/>
			) : (
				<CapturePlaceholder cue={cue} />
			)}
			<div
				style={{
					background:
						"linear-gradient(180deg, rgba(5, 10, 18, 0.24) 0%, rgba(5, 10, 18, 0) 28%, rgba(5, 10, 18, 0.62) 100%)",
					inset: 0,
					position: "absolute",
				}}
			/>
			<div
				style={{
					inset: "24px 24px auto",
					position: "absolute",
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
							background: "rgba(255, 255, 255, 0.14)",
							border: `1px solid ${glassBorder}`,
							borderRadius: 999,
							color: "white",
							fontFamily:
								'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
							fontSize: 14,
							fontWeight: 700,
							padding: "10px 16px",
						}}
					>
						{cue.label}
					</div>
				</div>
			</div>
		</div>
	);
}

function OverlayPanel({
	accent,
	body,
	eyebrow,
	title,
}: {
	accent: string;
	body: string;
	eyebrow: string;
	title: string;
}) {
	return (
		<div
			style={{
				backdropFilter: "blur(14px)",
				background: "rgba(8, 13, 23, 0.64)",
				border: `1px solid ${glassBorder}`,
				borderRadius: 28,
				bottom: 28,
				display: "grid",
				gap: 14,
				left: 28,
				maxWidth: 760,
				padding: "26px 28px",
				position: "absolute",
			}}
		>
			<div
				style={{
					alignItems: "center",
					color: accent,
					display: "inline-flex",
					fontFamily:
						'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					fontSize: 14,
					fontWeight: 700,
					gap: 10,
					letterSpacing: "0.14em",
					textTransform: "uppercase",
				}}
			>
				<span
					style={{
						background: accent,
						borderRadius: 999,
						display: "inline-block",
						height: 7,
						width: 7,
					}}
				/>
				{eyebrow}
			</div>
			<h2
				style={{
					color: "white",
					fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
					fontSize: 48,
					fontWeight: 600,
					letterSpacing: "-0.04em",
					lineHeight: 0.98,
					margin: 0,
				}}
			>
				{title}
			</h2>
			<p
				style={{
					color: "rgba(255, 255, 255, 0.82)",
					fontFamily:
						'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					fontSize: 22,
					lineHeight: 1.45,
					margin: 0,
				}}
			>
				{body}
			</p>
		</div>
	);
}

function FootageFocusedScene({
	accent,
	beat,
	cue,
	footageAvailability,
	footageMode,
}: {
	accent: string;
	beat: SceneBeat;
	cue: FootageCue;
	footageAvailability: Record<string, boolean>;
	footageMode: SalesPitchFootageMode;
}) {
	return (
		<Stage>
			<div
				style={{
					height: "100%",
					position: "relative",
				}}
			>
				<FootageCanvas
					cue={cue}
					isAvailable={footageAvailability[cue.id] ?? false}
					mode={footageMode}
				/>
				<OverlayPanel
					accent={accent}
					body={beat.description}
					eyebrow={beat.eyebrow}
					title={beat.title}
				/>
			</div>
		</Stage>
	);
}

export function ProblemOpenScene({ beat }: SalesPitchSceneProps) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const reveal = sceneEnter(frame, fps);
	const titleLift = interpolate(reveal, [0, 1], [48, 0]);

	return (
		<Stage>
			<div
				style={{
					display: "grid",
					gap: 36,
					gridTemplateColumns: "1fr 0.8fr",
					height: "100%",
				}}
			>
				<div
					style={{
						display: "grid",
						gap: 28,
						paddingTop: 36,
						transform: `translateY(${titleLift}px)`,
					}}
				>
					<div
						style={{
							alignItems: "center",
							display: "flex",
							gap: 18,
						}}
					>
						<img
							alt=""
							src={staticFile("icon-moonbeam.svg")}
							style={{
								height: 58,
								width: 58,
							}}
						/>
						<div
							style={{
								color: "rgba(15, 23, 42, 0.86)",
								fontFamily:
									'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
								fontSize: 26,
								fontWeight: 700,
								letterSpacing: "-0.03em",
							}}
						>
							StoreAI
						</div>
					</div>
					<div
						style={{
							color: storefrontAccent,
							fontFamily:
								'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
							fontSize: 16,
							fontWeight: 700,
							letterSpacing: "0.14em",
							textTransform: "uppercase",
						}}
					>
						{beat.eyebrow}
					</div>
					<h1
						style={{
							color: "#09090b",
							fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
							fontSize: 88,
							fontWeight: 600,
							letterSpacing: "-0.06em",
							lineHeight: 0.92,
							margin: 0,
							textWrap: "balance",
						}}
					>
						{beat.title}
					</h1>
					<p
						style={{
							color: "rgba(39, 39, 42, 0.84)",
							fontFamily:
								'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
							fontSize: 30,
							lineHeight: 1.42,
							margin: 0,
							maxWidth: 760,
						}}
					>
						StoreAI connects a shopper-facing concierge with a merchant-facing control layer, so the
						store gets AI help without losing operational control.
					</p>
				</div>

				<div
					style={{
						alignSelf: "end",
						display: "grid",
						gap: 18,
						paddingBottom: 36,
					}}
				>
					<div
						style={{
							background: "rgba(255, 255, 255, 0.64)",
							border: "1px solid rgba(15, 23, 42, 0.08)",
							borderRadius: 28,
							boxShadow: "0 22px 60px rgba(15, 23, 42, 0.08)",
							display: "grid",
							gap: 10,
							padding: "26px 28px",
						}}
					>
						<div
							style={{
								color: storefrontAccent,
								fontFamily:
									'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
								fontSize: 15,
								fontWeight: 700,
								letterSpacing: "0.14em",
								textTransform: "uppercase",
							}}
						>
							Shopper side
						</div>
						<div
							style={{
								color: "#09090b",
								fontFamily:
									'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
								fontSize: 30,
								fontWeight: 700,
								letterSpacing: "-0.03em",
							}}
						>
							Recommendations, policy answers, and cart plans.
						</div>
					</div>
					<div
						style={{
							background: "rgba(15, 23, 42, 0.92)",
							border: "1px solid rgba(255, 255, 255, 0.08)",
							borderRadius: 28,
							boxShadow: "0 24px 72px rgba(15, 23, 42, 0.2)",
							display: "grid",
							gap: 10,
							padding: "26px 28px",
						}}
					>
						<div
							style={{
								color: "rgba(255, 255, 255, 0.64)",
								fontFamily:
									'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
								fontSize: 15,
								fontWeight: 700,
								letterSpacing: "0.14em",
								textTransform: "uppercase",
							}}
						>
							Merchant side
						</div>
						<div
							style={{
								color: "white",
								fontFamily:
									'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
								fontSize: 30,
								fontWeight: 700,
								letterSpacing: "-0.03em",
							}}
						>
							Approvals, workflow traces, and audience-scoped knowledge.
						</div>
					</div>
				</div>
			</div>
		</Stage>
	);
}

export function ShopperAssistantScene({
	beat,
	footageAvailability,
	footageById,
	footageMode,
}: SalesPitchSceneProps) {
	const frame = useCurrentFrame();
	const recommendationCue = footageById["shopper-recommendation"];
	const cartPlanCue = footageById["shopper-cart-plan"];
	const localFrame = frame - beat.startFrame;
	const swapPoint = Math.round((beat.endFrame - beat.startFrame) * 0.56);
	const cue = localFrame < swapPoint ? recommendationCue : cartPlanCue;

	return (
		<FootageFocusedScene
			accent={storefrontAccent}
			beat={beat}
			cue={cue}
			footageAvailability={footageAvailability}
			footageMode={footageMode}
		/>
	);
}

export function TrustScene({
	beat,
	footageAvailability,
	footageById,
	footageMode,
}: SalesPitchSceneProps) {
	return (
		<FootageFocusedScene
			accent={trustAccent}
			beat={beat}
			cue={footageById["shopper-refusal"]}
			footageAvailability={footageAvailability}
			footageMode={footageMode}
		/>
	);
}

export function MerchantOverviewScene({
	beat,
	footageAvailability,
	footageById,
	footageMode,
}: SalesPitchSceneProps) {
	return (
		<FootageFocusedScene
			accent={merchantAccent}
			beat={beat}
			cue={footageById["merchant-dashboard"]}
			footageAvailability={footageAvailability}
			footageMode={footageMode}
		/>
	);
}

export function ApprovalScene({
	beat,
	footageAvailability,
	footageById,
	footageMode,
}: SalesPitchSceneProps) {
	return (
		<FootageFocusedScene
			accent={merchantAccent}
			beat={beat}
			cue={footageById["merchant-approval-flow"]}
			footageAvailability={footageAvailability}
			footageMode={footageMode}
		/>
	);
}

export function GroundingScene({
	beat,
	footageAvailability,
	footageById,
	footageMode,
}: SalesPitchSceneProps) {
	return (
		<FootageFocusedScene
			accent={merchantAccent}
			beat={beat}
			cue={footageById["merchant-document-grounding"]}
			footageAvailability={footageAvailability}
			footageMode={footageMode}
		/>
	);
}

export function ClosingScene({
	beat,
	brandLabel,
	footageAvailability,
	footageById,
	footageMode,
	subtitleLabel,
}: SalesPitchSceneProps) {
	const cue = footageById["merchant-traceability-close"];
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const reveal = sceneEnter(frame - beat.startFrame, fps, 4);

	return (
		<Stage>
			<div
				style={{
					height: "100%",
					position: "relative",
				}}
			>
				<FootageCanvas
					cue={cue}
					isAvailable={footageAvailability[cue.id] ?? false}
					mode={footageMode}
				/>
				<div
					style={{
						inset: 0,
						position: "absolute",
					}}
				>
					<div
						style={{
							alignItems: "flex-start",
							display: "grid",
							gap: 24,
							left: 28,
							maxWidth: 820,
							position: "absolute",
							top: 28,
							transform: `translateY(${interpolate(reveal, [0, 1], [30, 0])}px)`,
						}}
					>
						<div
							style={{
								alignItems: "center",
								backdropFilter: "blur(14px)",
								background: "rgba(8, 13, 23, 0.58)",
								border: `1px solid ${glassBorder}`,
								borderRadius: 999,
								color: "white",
								display: "inline-flex",
								gap: 16,
								padding: "14px 18px",
							}}
						>
							<img
								alt=""
								src={staticFile("icon-moonbeam.svg")}
								style={{
									height: 30,
									width: 30,
								}}
							/>
							<div
								style={{
									display: "grid",
									gap: 2,
								}}
							>
								<div
									style={{
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
										color: "rgba(255, 255, 255, 0.72)",
										fontFamily:
											'"SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
										fontSize: 14,
										fontWeight: 600,
									}}
								>
									{subtitleLabel}
								</div>
							</div>
						</div>

						<TitleStack
							accent={storefrontAccent}
							body="Use one AI system to guide the shopper, protect the merchant, and leave a visible operational trail behind every meaningful action."
							eyebrow={beat.eyebrow}
							title={beat.title}
						/>
					</div>
				</div>
			</div>
		</Stage>
	);
}
