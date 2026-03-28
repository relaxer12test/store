export interface NavigationHrefItem {
	href: string;
}

export type NavigationItemActiveState = "inactive" | "ancestor" | "current";

function normalizeNavigationPath(path: string) {
	if (path === "/") {
		return path;
	}

	return path.endsWith("/") ? path.slice(0, -1) : path;
}

function matchesNavigationPath(pathname: string, href: string) {
	const normalizedPathname = normalizeNavigationPath(pathname);
	const normalizedHref = normalizeNavigationPath(href);

	if (normalizedHref === "/") {
		return normalizedPathname === "/";
	}

	return (
		normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)
	);
}

export function resolveNavigationItemActiveStates<TItem extends NavigationHrefItem>(
	pathname: string,
	items: readonly TItem[],
) {
	const matchingItems = items
		.map((item, index) => ({
			href: item.href,
			index,
		}))
		.filter((item) => matchesNavigationPath(pathname, item.href));

	if (matchingItems.length === 0) {
		return items.map<NavigationItemActiveState>(() => "inactive");
	}

	let currentItem = matchingItems[0];

	for (const item of matchingItems.slice(1)) {
		if (item.href.length > currentItem.href.length) {
			currentItem = item;
		}
	}

	const ancestorIndexes = new Set(
		matchingItems.filter((item) => item.index !== currentItem.index).map((item) => item.index),
	);

	return items.map<NavigationItemActiveState>((_item, index) => {
		if (index === currentItem.index) {
			return "current";
		}

		return ancestorIndexes.has(index) ? "ancestor" : "inactive";
	});
}
