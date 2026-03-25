import * as Headless from "@headlessui/react";
import { Link as RouterLink } from "@tanstack/react-router";
import type React from "react";
import { forwardRef } from "react";

export type LinkProps = { href: string } & Omit<React.ComponentPropsWithoutRef<"a">, "href">;

function isExternalHref(href: string) {
	return (
		href.startsWith("http://") ||
		href.startsWith("https://") ||
		href.startsWith("//") ||
		href.startsWith("mailto:") ||
		href.startsWith("tel:") ||
		href.startsWith("#")
	);
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
	{ href, rel, target, ...props },
	ref,
) {
	const finalRel = target === "_blank" && !rel ? "noopener noreferrer" : rel;

	return (
		<Headless.DataInteractive>
			{isExternalHref(href) ? (
				<a {...props} href={href} ref={ref} rel={finalRel} target={target} />
			) : (
				<RouterLink
					{...(props as Omit<typeof props, never>)}
					preload="intent"
					ref={ref as never}
					rel={finalRel}
					target={target}
					to={href as never}
				/>
			)}
		</Headless.DataInteractive>
	);
});
