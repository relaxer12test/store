import { Outlet } from "@tanstack/react-router";
import { StatusPill } from "@/components/ui/feedback";
import { PageHeader, SurfaceNav, type SurfaceNavItem } from "@/components/ui/layout";

interface SurfaceLayoutProps {
	description: string;
	eyebrow: string;
	navItems: SurfaceNavItem[];
	notice?: React.ReactNode;
	statusLabel: string;
	title: string;
}

export function SurfaceLayout({
	description,
	eyebrow,
	navItems,
	notice,
	statusLabel,
	title,
}: SurfaceLayoutProps) {
	return (
		<div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
			<PageHeader
				actions={<StatusPill tone="success">{statusLabel}</StatusPill>}
				description={description}
				eyebrow={eyebrow}
				title={title}
			/>

			{notice ? <div className="mt-6">{notice}</div> : null}

			<div className="mt-8">
				<SurfaceNav items={navItems} label={`${title} navigation`} />
			</div>

			<div className="mt-8">
				<Outlet />
			</div>
		</div>
	);
}
