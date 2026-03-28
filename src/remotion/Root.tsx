import { Composition } from "remotion";
import {
	SALES_PITCH_FPS,
	SALES_PITCH_HEIGHT,
	SALES_PITCH_TOTAL_FRAMES,
	SALES_PITCH_WIDTH,
} from "@/remotion/compositions/sales-pitch/sales-pitch.data";
import type { SalesPitchCompositionProps } from "@/remotion/compositions/sales-pitch/sales-pitch.types";
import { SalesPitchComposition } from "@/remotion/compositions/sales-pitch/SalesPitchComposition";

const defaultProps: SalesPitchCompositionProps = {
	brandLabel: "StoreAI",
	footageMode: "auto",
	showGuides: false,
	showSubtitles: true,
	subtitleLabel: "Shopify AI Console",
};

export function RemotionRoot() {
	return (
		<>
			<Composition
				component={SalesPitchComposition}
				defaultProps={defaultProps}
				durationInFrames={SALES_PITCH_TOTAL_FRAMES}
				fps={SALES_PITCH_FPS}
				height={SALES_PITCH_HEIGHT}
				id="StoreAISalesPitch"
				width={SALES_PITCH_WIDTH}
			/>
		</>
	);
}
