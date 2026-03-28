import * as Headless from "@headlessui/react";
import { useLinkProps } from "@tanstack/react-router";
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
	{ children, href, rel, target, ...props },
	ref,
) {
	const explicitAriaCurrent = props["aria-current"];
	const externalHref = isExternalHref(href);
	const finalRel = target === "_blank" && !rel ? "noopener noreferrer" : rel;
	const routerLinkProps = useLinkProps(
		{
			...(props as Omit<typeof props, never>),
			href: externalHref ? href : undefined,
			preload: externalHref ? false : "intent",
			rel: finalRel,
			target,
			to: externalHref ? undefined : (href as never),
		},
		ref,
	);
	const { "aria-current": _ariaCurrent, "data-status": _dataStatus, ...safeLinkProps } =
		routerLinkProps;

	return (
		<Headless.DataInteractive>
			<a {...safeLinkProps} aria-current={explicitAriaCurrent}>
				{children}
			</a>
		</Headless.DataInteractive>
	);
});
