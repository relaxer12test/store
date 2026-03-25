# Unicorn Demo Store Content Plan

## Context
This repo needs a believable Shopify demo store that makes the storefront AI and embedded merchant app feel real. The store should be visually distinct, easy to merchandise, safe to seed with synthetic content, and structured enough that a later implementation pass can create products, collections, pages, and public AI-grounding docs without re-asking brand questions.

## Objective
Define a complete, self-contained plan for a kid-themed unicorn storefront, including the brand premise, catalog structure, exact launch pricing, content-generation workflow, image-sourcing rules, and the public documents the storefront AI should use.

## Open Questions
None. Use the defaults in this file unless the user explicitly changes the store concept later.

## Locked Decisions
- Working brand name: `Moonbeam Unicorn Club`
- Core premise: a unicorn dress-up and play boutique for kids, sold to parents, gift buyers, and birthday-party planners
- Buyer vs user: parents make the purchase; kids are the imaginative end user
- Age focus: roughly ages `4-9`
- Brand tone: whimsical, kind, storybook, polished enough for adult buyers
- Visual direction: pastel but not chaotic, more moonbeam and rainbow than glitter explosion
- Published catalog target: `650-850` products, with `500-1000` accepted as the practical range
- Catalog composition target:
  - `60-90` hero products with richer copy and fuller image sets
  - `220-320` standard products with solid but lighter PDP treatment
  - `220-440` long-tail products generated from approved family templates
- Initial launch collections:
  - Dress-Up
  - Plush & Toys
  - Party Shop
  - Room Magic
  - Craft & Activity
  - Gift Bundles
  - Seasonal Magic
- Commerce posture: mid-market boutique, not bargain-bin and not Pottery Barn luxury
- Product claims rule: do not invent certifications, hypoallergenic claims, sustainability claims, or safety claims unless they are actually sourced
- Reviews rule: do not generate fake customer reviews
- Image rule: do not reuse retailer photos from research sources; they are pricing/style references only

## Why This Premise Works
- Unicorn is immediately legible on first page load.
- The category supports variants, bundles, upsells, seasonal campaigns, and gift flows.
- The catalog can mix dress-up, plush, decor, and party products without feeling random.
- The storefront AI can answer useful shopper questions about age fit, gifting, party planning, room decor, and bundle building.
- The embedded merchant app can demo catalog management, merchandising, bundles, public knowledge docs, and diagnostics against a coherent fake store.

## Audience And Positioning

### Primary Buyers
- Parents shopping for birthdays, dress-up, and gifts
- Relatives buying easy-present items
- Party planners shopping for themed supplies

### Secondary Users
- Kids who like fantasy, color, costumes, plush, crafts, and bedroom decor

### Positioning Sentence
`Moonbeam Unicorn Club` sells costumes, cuddle toys, party kits, room decor, and creative play sets for little dreamers who want their own unicorn world.

### Tone Rules
- Write like a warm boutique brand, not a toy catalog dump.
- Keep the magic language soft and storybook.
- Speak to parents with clarity about what is included, what age it fits, and when it is good as a gift.
- Avoid hard-sell language.
- Avoid sarcasm, irony, or teen slang.
- Keep copy gender-open even though the palette can skew pastel.

## Research Summary And Pricing Interpretation

### What Current Retailers Show
- Kids unicorn accessories commonly sit around `4.00-14.99` at Claire's, with accessory bundles around `24.99`.
- Current costume listings commonly land around `24.99-64.99` at HalloweenCostumes, with more premium light-up options reaching roughly `59-99` at Pottery Barn Kids.
- Entry unicorn plush is around `9.99` at Target and Walmart, while more decorative or premium plush products are around `22.99-49.00` at Pottery Barn Kids and around `44.99` for a large Disney plush.
- Unicorn night lights commonly sit around `19.99-29.99` at Target and Walmart.
- Party components at Meri Meri cluster around `11.50` for plates, `14-16` for candles, `18.00` for cupcake kits, `20.00` for party bags, and `70.00` for a full unicorn party set.
- Activity and stationery kits commonly sit around `9.97-28.99` across Walmart, Target, and Claire's.

### Pricing Decision For This Demo Store
Use the middle of the current market, slightly above mass retail and below premium heritage kids brands.

- Accessories: `10-16`
- Crafts and small activity kits: `14-22`
- Plush and simple toys: `18-32`
- Interactive or giftable hero plush: `38-46`
- Costumes and dress-up sets: `24-58`
- Room decor and night lights: `24-36`
- Party components: `14-20`
- Party bundles and gift bundles: `58-74`

### Compare-At Price Rule
- Only use compare-at pricing on about `20-30%` of the catalog.
- When used, keep compare-at roughly `15-25%` above the actual selling price.
- Do not put every item "on sale." The store should feel credible.

## Scaled Catalog Strategy

### Why The Store Should Scale By Families
- A store looks real when collection pages are dense, filters are populated, and search returns many believable results.
- It does not require `800` completely unique hero concepts.
- The scalable pattern is: define strong product families, then expand each family through approved style, color, size, and occasion variants.
- The catalog should feel broad, but still clearly owned by one brand.

### Count Plan By Collection

| Collection | Target Product Count | Notes |
| --- | ---: | --- |
| Dress-Up | 120-170 | Capes, tutu sets, pajamas, slippers, accessories, costumes |
| Plush & Toys | 140-190 | Plush families, figure sets, tea sets, play kits, pillows |
| Party Shop | 100-150 | Party bags, banners, plates, cupcake kits, favors, sets |
| Room Magic | 80-120 | Lamps, decals, cushions, garlands, storage, bedding-adjacent decor |
| Craft & Activity | 100-150 | Sticker kits, bracelet kits, paint kits, slime kits, terrariums |
| Gift Bundles | 25-40 | Age, price, and occasion bundles |
| Seasonal Magic | 40-80 | Halloween, holiday gifting, back-to-school, birthday capsule items |
| Total | 605-900 | Leaves room to land inside the `500-1000` target |

### Product Tiering

#### Tier 1: Hero Products
- Use for the best `60-90` products.
- These need the richest copy, best imagery, strongest merchandising, and cross-sells.
- These are homepage candidates and AI recommendation anchors.

#### Tier 2: Standard Products
- Use for the next `220-320` products.
- These should still feel polished, but can reuse family-level copy structures and simpler image sets.

#### Tier 3: Long-Tail Products
- Use for the remaining `220-440` products.
- These exist to make category pages, filters, search, and recommendation flows feel like a real store.
- They should be believable and clean, not generic filler.
- Long-tail products must still follow naming, pricing, and image-system rules.

## Anchor Catalog

### Catalog Architecture Rules
- Keep handles clean and descriptive.
- Use `2-4` variant groups per category at most.
- Prefer `color`, `size`, and `format` as option axes.
- Avoid too many personalized products in v1.
- Keep most products under `3` options so setup stays quick.
- Treat the table below as anchor families and hero examples, not the full published catalog.

### Anchor SKU Table

| Handle | Product | Collection | Price | Variants | Notes |
| --- | --- | --- | ---: | --- | --- |
| `stardust-unicorn-cape` | Stardust Unicorn Cape | Dress-Up | 24.00 | Size: 4-6, 7-9 | Entry dress-up hero |
| `rainbow-mane-tutu-set` | Rainbow Mane Tutu Set | Dress-Up | 38.00 | Size: 4-6, 7-9 | Includes tutu, headband, wand |
| `golden-horn-dress-up-kit` | Golden Horn Dress-Up Kit | Dress-Up | 16.00 | Color: Pink, Lilac | Accessory upsell |
| `twinkle-trail-light-up-wand` | Twinkle Trail Light-Up Wand | Dress-Up | 12.00 | Color: Pink, Mint | Add-on at cart |
| `moonbeam-unicorn-pajama-set` | Moonbeam Unicorn Pajama Set | Dress-Up | 34.00 | Size: 4T, 5, 6, 7, 8 | Cozy bedtime item |
| `cloud-step-unicorn-slippers` | Cloud Step Unicorn Slippers | Dress-Up | 22.00 | Size: S, M, L | Good bundle filler |
| `starlight-tutu-costume` | Starlight Tutu Costume | Dress-Up | 54.00 | Size: 4-6, 7-9 | Premium costume hero |
| `cuddly-cloud-unicorn-plush` | Cuddly Cloud Unicorn Plush | Plush & Toys | 18.00 | Size: Mini, Classic | Entry plush |
| `dreamy-mane-unicorn-plush` | Dreamy Mane Unicorn Plush | Plush & Toys | 28.00 | Color: Blush, Lavender | Mid-tier plush |
| `glow-spark-unicorn-plush` | Glow Spark Unicorn Plush | Plush & Toys | 44.00 | Color: Cream, Pink | Interactive plush hero |
| `rainbow-tea-party-set` | Rainbow Tea Party Set | Plush & Toys | 42.00 | Default | Imaginative play hero |
| `pocket-unicorn-friends` | Pocket Unicorn Friends Figure Set | Plush & Toys | 16.00 | Pack: 4, 8 | Impulse toy |
| `moon-pillow-unicorn-cushion` | Moon Pillow Unicorn Cushion | Plush & Toys | 32.00 | Color: Blush, Sky | Giftable decor crossover |
| `moonlight-unicorn-night-lamp` | Moonlight Unicorn Night Lamp | Room Magic | 34.00 | Color: Warm Glow, Rainbow Glow | Bedroom hero |
| `rainbow-stable-wall-decals` | Rainbow Stable Wall Decal Set | Room Magic | 26.00 | Default | Low-risk decor |
| `star-cloud-storage-bin` | Star Cloud Storage Bin | Room Magic | 24.00 | Color: Pink, Cream | Utility merchandises well |
| `moonbeam-bunting-garland` | Moonbeam Bunting Garland | Room Magic | 18.00 | Default | Also cross-sells to Party Shop |
| `sparkle-sticker-studio` | Sparkle Sticker Studio | Craft & Activity | 14.00 | Default | Entry activity item |
| `paint-your-own-unicorn-kit` | Paint Your Own Unicorn Kit | Craft & Activity | 18.00 | Default | Strong PDP visuals |
| `unicorn-bracelet-box` | Unicorn Bracelet Box | Craft & Activity | 16.00 | Default | Gift-friendly craft |
| `rainbow-slime-lab` | Rainbow Slime Lab | Craft & Activity | 22.00 | Default | Higher-energy activity |
| `magic-terrarium-kit` | Magic Terrarium Kit | Craft & Activity | 28.00 | Default | Premium craft hero |
| `moonbeam-party-bags-8pk` | Moonbeam Party Bags (8 Pack) | Party Shop | 20.00 | Default | Party add-on |
| `starlight-cupcake-kit` | Starlight Cupcake Kit | Party Shop | 18.00 | Default | Easy party upsell |
| `meadow-unicorn-candles` | Meadow Unicorn Candles | Party Shop | 14.00 | Default | Low-price attach item |
| `i-believe-in-unicorns-banner` | I Believe In Unicorns Banner | Party Shop | 18.00 | Default | Main decor piece |
| `unicorn-party-box-for-8` | Unicorn Party Box For 8 | Party Shop | 68.00 | Default | Anchor party bundle |
| `little-dreamer-gift-bundle` | Little Dreamer Gift Bundle | Gift Bundles | 58.00 | Plush Color: Blush, Lavender | Entry gift box |
| `birthday-magic-bundle` | Birthday Magic Bundle | Gift Bundles | 74.00 | Age Band: 4-6, 7-9 | Cross-collection bundle |
| `sleepover-sparkle-bundle` | Sleepover Sparkle Bundle | Gift Bundles | 64.00 | Default | Pajama, slippers, sticker set |

### Bundle Logic
- `Little Dreamer Gift Bundle`: `Cuddly Cloud Unicorn Plush + Twinkle Trail Light-Up Wand + Sparkle Sticker Studio`
- `Birthday Magic Bundle`: `Stardust Unicorn Cape + Glow Spark Unicorn Plush + Starlight Cupcake Kit + Meadow Unicorn Candles`
- `Sleepover Sparkle Bundle`: `Moonbeam Unicorn Pajama Set + Cloud Step Unicorn Slippers + Sparkle Sticker Studio`

### Bundle Discount Rule
- Price bundles at roughly `10-12%` below individual item total.
- Show the bundle savings clearly, but do not overdo the sale framing.

## Family Expansion Rules

### Expansion Principle
Scale from a controlled set of approved families instead of inventing hundreds of random products.

### Family Multipliers
Each approved family can expand through:
- style name
- colorway
- size band
- pack size
- occasion tag
- seasonal finish

### Example Expansion Pattern

#### Dress-Up Capes
- Families: `Stardust`, `Moonbeam`, `Rainbow Trail`, `Golden Horn`, `Sugar Cloud`, `Starfall`
- Colorways per family: `2-4`
- Sizes per family: `2-3`
- Expected products from this family group: `24-72`

#### Plush
- Families: `Cuddly Cloud`, `Dreamy Mane`, `Twinkle Hoof`, `Moon Snuggle`, `Glow Spark`, `Rainbow Comet`
- Size formats per family: `2-3`
- Colorways per family: `2-4`
- Expected products from this family group: `24-72`

#### Party Supplies
- Families: `Moonbeam Party`, `Meadow Unicorn`, `Starlight Birthday`, `Rainbow Castle`, `Sugar Cloud Celebration`
- Components per family: `6-10`
- Pack-size variants where reasonable: `1-2`
- Expected products from this family group: `30-80`

#### Crafts
- Families: `Sticker Studio`, `Paint Box`, `Bracelet Box`, `Slime Lab`, `Sparkle Sketch`, `Terrarium Garden`
- Formats per family: `3-6`
- Expected products from this family group: `18-36`

### Naming Formula
Use:
- `[Magic adjective] + [unicorn noun] + [product type]`
- `[Occasion adjective] + [unicorn theme] + [product type]`

Examples:
- `Moonbeam Unicorn Cape`
- `Rainbow Trail Dress-Up Wings`
- `Starlight Birthday Cupcake Kit`
- `Sugar Cloud Plush Unicorn`

### Long-Tail Product Rule
- At least `70%` of the large catalog should be generated from these family systems.
- The remaining `30%` can be hero concepts, bundles, or seasonal one-offs.
- Do not create isolated names that never repeat as a family.

## Collections And Merchandising Rules

### Dress-Up
- Lead with the `Starlight Tutu Costume`.
- Secondary hero should be the `Rainbow Mane Tutu Set`.
- Cross-sell wand, slippers, and plush.
- Recommended collection blurb angle: pretend play, birthdays, sleepovers.

### Plush & Toys
- Lead with `Glow Spark Unicorn Plush`.
- Secondary hero should be `Rainbow Tea Party Set`.
- Keep page softer and cozier than Dress-Up.

### Room Magic
- Lead with `Moonlight Unicorn Night Lamp`.
- Use room vignettes, not isolated white-background-only visuals.
- Cross-sell with pajamas and plush.

### Craft & Activity
- Lead with `Magic Terrarium Kit`.
- Emphasize rainy-day play, gifting, and screen-free creativity.
- Include age guidance directly in bullets.

### Party Shop
- Lead with `Unicorn Party Box For 8`.
- Show add-on flow: banner -> cupcake kit -> candles -> party bags.
- Use one assembled party scene and one clear flat-lay image.

### Gift Bundles
- This collection exists to help the AI concierge recommend quick purchases.
- Use tags like `giftable`, `birthday`, `sleepover`, `under-60`, `hero-bundle`.

### Seasonal Magic
- Use this for Halloween costumes, holiday gifts, birthday capsule sets, and back-to-school accessories.
- Keep it tightly curated even if the product count is high.
- Use seasonal tags instead of drifting into unrelated categories.

## Content To Generate

### Product Content
Generate by tier rather than forcing identical work on all `500-1000` products.

#### Tier 1 Product Content
Generate for every hero product:
- Product title
- Short subtitle, `6-10` words
- `90-140` word product description
- `4-6` scannable bullets
- Included-in-box section
- Age guidance line
- Care line if relevant
- Dimensions or approximate size descriptor
- Gift occasion tag
- SEO title and meta description
- `3-5` alt text strings per product image
- `5-8` search tags

#### Tier 2 Product Content
Generate for every standard product:
- Product title
- Short subtitle, `4-8` words
- `70-110` word description
- `4-5` bullets
- Included-in-box section when relevant
- Age guidance line
- SEO title and meta description
- `2-3` alt text strings
- `4-6` search tags

#### Tier 3 Product Content
Generate for every long-tail product:
- Product title
- One-sentence description, `35-70` words
- `3-4` bullets
- Age guidance line when relevant
- SEO title and meta description
- `1-2` alt text strings
- `3-5` search tags

### Collection Content
Generate for every collection:
- One `30-50` word hero blurb
- One `80-120` word intro paragraph
- One short CTA line
- One shopper-help question prompt for the storefront AI

### Homepage Content
Generate:
- Main hero headline
- Main hero supporting paragraph
- Primary CTA and secondary CTA
- `3` trust/value chips
- Featured collection headings
- One party-planning promo banner
- One gift-guide promo banner
- One FAQ strip
- One newsletter/signup line

### Public Knowledge Docs For Storefront AI
Create and upload as public docs:
- `gift-guide.md`
- `birthday-party-guide.md`
- `dress-up-size-guide.md`
- `shipping-and-delivery.md`
- `returns-and-gift-returns.md`
- `care-guide.md`
- `age-and-activity-guide.md`
- `about-moonbeam-unicorn-club.md`

### Blog Or Editorial Pages
Create at least:
- `5 birthday-party ideas for unicorn fans`
- `How to choose a unicorn gift by age`
- `How to build a magical dress-up box`
- `Cozy room decor ideas for little dreamers`
- `Rainy-day unicorn activities for kids`

## Source Of Truth For Generated Content

### Canonical Facts
Use this file as the product and pricing source of truth.

### Facts That May Be Generated
- Product descriptions
- Collection blurbs
- Homepage copy
- FAQ copy
- Gift-guide copy
- SEO metadata
- Image alt text

### Facts That Must Not Be Invented
- Exact fabric composition
- Safety certifications
- Country of origin
- Wash instructions beyond generic reasonable care
- Battery details unless explicitly defined for a product
- Claims like `organic`, `BPA-free`, `hypoallergenic`, `handmade`, `sensory-safe`, or `adaptive`

### Safe Defaults When Copy Needs Specificity
- Use `soft-touch finish` instead of exact material claims
- Use `recommended for imaginative play ages 4+` instead of regulatory claims
- Use `spot clean` only for decor/plush if no stronger care statement exists
- Use `lightweight` and `easy-to-store` instead of fabricated measurements when dimensions are not entered

## Product Content Template

### Product Data Schema
For each product, fill these fields before asking an LLM to write copy:

```json
{
  "handle": "",
  "title": "",
  "collection": "",
  "price": 0,
  "compare_at_price": null,
  "age_band": "",
  "variants": [],
  "included_in_box": [],
  "hero_benefit": "",
  "secondary_benefit": "",
  "gift_moment": "",
  "care": "",
  "dimensions": "",
  "cross_sells": []
}
```

### Copy Prompt Template
Use this prompt structure for product copy generation:

```text
You are writing Shopify product copy for Moonbeam Unicorn Club, a whimsical but polished unicorn boutique for kids ages 4-9 and for the parents who buy for them.

Write:
1. A short subtitle
2. A product description between 90 and 140 words
3. 5 bullet points
4. A one-line "Included in the box" section
5. A one-line age guidance section
6. An SEO title under 60 characters
7. A meta description under 155 characters

Rules:
- Keep the tone warm, magical, and parent-friendly
- Do not invent certifications or materials
- Do not say "perfect" or "must-have"
- Mention what is included and why it is giftable
- Keep the writing easy to scan

Product data:
[PASTE STRUCTURED DATA HERE]
```

## Homepage Content Plan

### Hero Direction
- Headline direction: magical world-building for little dreamers
- Support paragraph direction: costumes, cuddly toys, party magic, and creative play
- Primary CTA: `Shop Best Sellers`
- Secondary CTA: `Plan A Unicorn Party`

### Homepage Section Order
1. Hero
2. Featured collections
3. Best sellers
4. Gift bundles
5. Party-planning section
6. Cozy room magic section
7. Storefront AI helper section
8. FAQ strip

### Suggested Hero Copy Direction
- Headline concept: `A Little More Magic For Everyday Play`
- Supporting concept: `Discover unicorn costumes, cuddle toys, party kits, and room-brightening favorites for birthdays, sleepovers, and imaginative afternoons.`

## Shopify Insert Strategy

### What Shopify Already Supports
- Shopify CLI can insert content into a dev store by executing Admin GraphQL mutations.
- Use `shopify app execute` for smaller mutations and `shopify app bulk execute` for high-volume imports.
- Shopify CLI help explicitly states that mutations are allowed on dev stores.
- The Shopify Dev MCP server is for docs, schema introspection, and validation, not for mutating store content.

### Resources We Can Seed Through Admin GraphQL
- Products and variants through `productSet`
- Collections through `collectionCreate` and `collectionAddProducts`
- Pages through `pageCreate`
- Blogs and articles through `blogCreate` and `articleCreate`
- Menus through `menuCreate`
- Files and reusable media through `fileCreate`
- Structured merchandising content through `metaobjectUpsert`
- Channel visibility through `publishablePublish`

### Recommended Execution Model
- Build our own seeding script or dataset generator and use Shopify CLI as the execution transport during development.
- For small or iterative tests, run single mutations with `shopify app execute`.
- For the full `500-1000` product catalog, use `shopify app bulk execute` with JSONL variable files.
- Treat CLI as the write path for dev stores and the Admin API as the underlying platform surface.

### Seeder Decision
- We do need our own import layer on our end.
- Shopify gives us the write primitives, but not the full opinionated unicorn-catalog seeder we need.
- Our seeder should own data shaping, family expansion, image manifest generation, and mutation batching.

## Image Strategy

### Core Principle
Use generated product imagery for the actual catalog and licensed stock imagery for editorial or environmental scenes. Do not mix borrowed retailer product photography into the storefront.

### Image Source Priority
1. AI-generated product packshots and stylized lifestyle scenes for actual sellable products
2. Our own stable public asset host for generated outputs, preferably an R2-backed HTTPS origin
3. Burst by Shopify, Unsplash, or Pexels for lifestyle/editorial scenes that do not need exact product matches
4. Pixabay only as a fallback for simple decorative or background imagery

### Where To Grab Pictures From

#### Sellable Product Images
- Generate them ourselves because these products are fictional and stock libraries will not match our exact catalog.
- Store the generated outputs in an asset bucket we control, ideally a public R2 path with stable HTTPS URLs.
- Use one asset manifest row per image with: `sku`, `variant`, `source_type`, `source_url`, `license_note`, `alt`, `width`, `height`.

#### Editorial And Collection Images
- Use Burst first when a generic ecommerce or room image works.
- Use Unsplash or Pexels for lifestyle scenes, room setups, tabletop activity, balloons, cakes, and decorative backgrounds.
- Use Pixabay only if the other sources do not cover a simple supporting visual.

#### People And Kids Imagery
- Prefer generated scenes for child-model imagery because release confidence is simpler and visual consistency is higher.
- If using real-photo stock, prefer back views, hands, or room scenes over recognizable child portraits.
- Avoid imagery that could imply a real child endorses the brand.

### What To Generate With AI
- All product hero images
- Variant images
- Detail shots
- Packaged bundle images
- Consistent flat lays for party kits
- Bedroom vignettes for room decor

### What To Source From Stock Libraries
- Kids craft table scenes
- Party background scenes with balloons or cakes
- Playroom corners and soft bedroom environments
- Abstract rainbow, cloud, moonlight, pastel, and paper-texture editorial visuals

### What Not To Do
- Do not use Pottery Barn Kids, Claire's, Target, Walmart, Disney Store, or Meri Meri photos in the final store.
- Do not use stock photos with obvious third-party brands visible.
- Do not rely on lots of child-face closeups unless you are comfortable with release risk.
- Do not use one-off visual styles per product; the catalog needs to feel shot by one brand.

### Stock Source Rules

#### Unsplash
- Good for editorial scenes, party inspiration, kids room scenes, and craft activity imagery.
- Use with license awareness; commercial use is generally allowed.
- Be more careful with recognizable people and private property.
- Prefer scenes without visible brand logos.

#### Pexels
- Good for editorial and lifestyle scenes.
- Commercial use is generally allowed.
- Do not sell unmodified photos as products.
- Do not imply endorsement from people or brands shown in imagery.

#### Pixabay
- Use as a backup for decorative assets.
- Commercial use is allowed under their content license summary.
- Avoid anything with visible trademarks or anything that would become the primary thing being sold.

#### Burst By Shopify
- Good for generic ecommerce editorial shots and some product-adjacent lifestyle scenes.
- Commercial use is allowed under Burst's photo license.
- Burst is in maintenance mode, so use the current library opportunistically rather than depending on new coverage.
- Burst is unlikely to cover exact unicorn products, so use it for backgrounds and editorial context, not core fictional product media.

### Human Subject Rule
- For homepage/editorial use, prefer scenes with hands, back views, room setups, or tabletop activity.
- If a scene needs a visible child model, prefer generated imagery or premium licensed imagery with stronger release confidence.
- Avoid making any one real child the face of the brand.

## Image Production Specs

### Shopify-Oriented Asset Specs
- Product hero images: `2048x2048`
- Product detail images: `2048x2048`
- Collection/header banners: `2400x1200`
- Blog hero images: `1600x900`
- Social or promo square assets: `1080x1080`
- Keep background removal and shadows consistent.

### Variant Media Rule
- Shopify supports one image per variant association, so make sure each color/style variant has a clearly distinct main image.

### Image Set By Product Type

#### Tier 1 Dress-Up Products
- 1 front hero
- 1 angled hero
- 1 detail close-up
- 1 styled lifestyle shot
- 1 laid-out kit image

#### Tier 1 Plush Products
- 1 front hero
- 1 scale/context shot
- 1 room/lifestyle shot
- 1 detail close-up

#### Tier 1 Party Products
- 1 flat lay hero
- 1 assembled party scene
- 1 contents shot
- 1 detail close-up
- 1 packaging/giftability shot

#### Tier 1 Craft Kits
- 1 packaging hero
- 1 contents flat lay
- 1 in-progress scene
- 1 finished-result scene
- 1 close-up detail

#### Tier 1 Room Decor
- 1 isolated product shot
- 1 styled room vignette
- 1 scale/detail shot
- 1 alternate angle

#### Tier 2 Standard Products
- 1 hero image
- 1 alternate angle or detail image
- 1 lifestyle or context image for strong families only

#### Tier 3 Long-Tail Products
- 1 clean hero image
- 1 optional secondary image reused from the family template if needed
- Do not attempt five bespoke images for every long-tail item

### Alt Text Pattern
Use:
- `Product name on pastel background`
- `Child's room styled with Product name`
- `Close-up of Product name details`
- `Contents included with Product name`

Avoid:
- keyword stuffing
- repeating `image of`
- fictional material claims

## AI Image Prompting Rules

### Shared Visual Prompt Base
Use one shared base prompt across catalog images:

```text
storybook kids boutique product photography, pastel moonbeam palette, soft daylight studio lighting, clean premium e-commerce composition, whimsical but polished, no visible brand logos, child-safe playful styling, consistent lens and color treatment
```

### Per-Category Additions
- Dress-Up: `soft tulle, cape drape, sparkle accents, studio mannequin or invisible model styling`
- Plush: `soft cuddly texture, cozy bedroom styling, gentle shadows`
- Party: `flat lay or decorated dessert table, pastel balloons, gold foil accents`
- Craft: `organized art supplies, finished sample visible, clean tabletop`
- Room Decor: `calm playroom, nursery-adjacent but not baby-only, soft lamp glow`

### Image Consistency Rules
- Keep every product on the same visual system.
- Use one main background family per collection.
- Avoid photorealistic clutter.
- Avoid hyper-saturated neon.
- Avoid uncanny full-face child closeups.

## Media Upload Strategy

### Preferred Upload Path For This Store
- Prefer remote HTTPS image URLs over raw local uploads for the large seeded catalog.
- The cleanest path is:
  1. generate or license images
  2. place them on a stable public origin we control, ideally R2
  3. import them into Shopify with `productSet` or `fileCreate`
- This keeps the catalog import deterministic and easier to rerun.

### Remote URL Upload Path
- Use `fileCreate` with `contentType: IMAGE` and `originalSource` set to the public image URL when we want reusable Shopify file records.
- Use `productSet` file inputs with `originalSource` when creating products and attaching media in the same import flow.
- This is the best default for a large synthetic catalog because it avoids handling binary upload requests inside the seeder.

### Local Or Generated File Upload Path
- If an image only exists locally, call `stagedUploadsCreate` first.
- Shopify returns a temporary upload `url`, `parameters`, and a `resourceUrl`.
- Upload the file bytes to that target.
- Then use the returned `resourceUrl` as `originalSource` in `fileCreate` or subsequent product media mutations.

### When To Use Each Path
- Use remote URL ingestion for most product images, bundle shots, banners, and editorial assets.
- Use staged uploads for one-off local files, manual experiments, or cases where assets have not been mirrored to our public bucket yet.
- Do not make staged uploads the default for `500-1000` products unless we have no stable public asset host.

### Upload Validation Rules
- Keep source URLs valid and directly fetchable over HTTPS.
- Keep alt text under Shopify's limits.
- Track `fileStatus` until assets are ready.
- Reuse uploaded file IDs when the same asset belongs on multiple products or pages.

## Content Production Workflow

### Step 1: Create Structured Catalog Data
- Build a spreadsheet or seed file from the launch SKU table in this plan.
- Expand the anchor table into family matrices until the catalog lands between `500` and `1000` products.
- Add handle, title, collection, tier, price, variants, age band, bullets, cross-sells, and bundle membership.

### Step 2: Approve Family Matrices
- Lock family names, allowed colors, size bands, and pack formats before bulk generation.
- Reject any family that feels off-brand or too repetitive.

### Step 3: Generate Product Copy
- Write Tier 1 hero products first.
- Generate Tier 2 and Tier 3 products from approved family templates.
- Human-review for repetitive language, unsafe claims, and fake specificity.

### Step 4: Generate Collection And Homepage Copy
- Generate collection blurbs and homepage blocks after the product names are locked.
- Keep message hierarchy parent-friendly.

### Step 5: Generate Image Prompts
- Create one prompt family per collection and subfamily.
- Generate hero images first, then supporting angles.
- Reuse approved family setups for long-tail items so the catalog stays visually consistent.

### Step 6: Produce And Collect Assets
- Generate core product media and export them into a stable public asset origin.
- Pull editorial stock only for the pages that actually need it.
- Record every asset in an image manifest with its source and intended Shopify destination.

### Step 7: Import Media Into Shopify
- For remote assets, ingest images through `fileCreate` or directly through product media fields using `originalSource`.
- For local-only assets, use `stagedUploadsCreate`, upload binaries, then create Shopify file records from the returned `resourceUrl`.
- Reuse file records where the same image appears in multiple places.

### Step 8: Source Editorial Stock
- Pull only the editorial images the site actually needs.
- Track URLs and licenses in a simple asset register.

### Step 9: Import Into Shopify
- Upload product data, variant media, alt text, and collections.
- Make sure bundle components and tags are consistent for AI recommendations.
- Populate enough pagination depth and filter coverage that the store reads as real on browse and search pages.

### Step 10: Publish Public Docs
- Upload the public markdown docs for the storefront AI.
- Keep policy docs clear and plain-language.

### Step 11: QA
- Make sure the AI can answer gift, party, age, and bundle questions from public data only.
- Check that no collection page looks thin.
- Check that search for `unicorn`, `birthday`, `plush`, `cape`, `party`, and `gift` returns dense, believable results.
- Check that product media and collection art are all in `READY` state before final publishing.

## Public Knowledge Doc Content Requirements

### `about-moonbeam-unicorn-club.md`
- Brand story
- What the store sells
- Who it is for
- Tone and care philosophy

### `gift-guide.md`
- Gifts under `25`
- Gifts under `50`
- Best picks for ages `4-6`
- Best picks for ages `7-9`
- Best birthday gifts
- Best sleepover gifts

### `birthday-party-guide.md`
- Party box contents
- Best add-ons
- Planning checklist
- Quick cart suggestions

### `dress-up-size-guide.md`
- Simple size guidance by age band
- Notes on capes vs pajama sets vs slippers
- Parent-friendly fit advice

### `shipping-and-delivery.md`
- Clear demo-store shipping policy
- Processing window
- Gift order notes
- Non-claimy language

### `returns-and-gift-returns.md`
- Simple returns policy
- Gift return explanation
- What is final sale if anything

### `care-guide.md`
- Plush care
- Dress-up care
- Decor care
- Craft kit storage tips

### `age-and-activity-guide.md`
- Which products fit imaginative play
- Which products are best for quiet play
- Which products work for parties
- Which products make easy gifts

## Merchandising Tags
Add these tags consistently so the storefront AI and collections can use them:

- `best-seller`
- `new-arrival`
- `giftable`
- `birthday`
- `sleepover`
- `party`
- `room-decor`
- `dress-up`
- `craft`
- `under-25`
- `under-50`
- `ages-4-6`
- `ages-7-9`
- `bundle`
- `hero-product`

## Things To Avoid
- Do not make every product pink.
- Do not turn the store into generic princess merch.
- Do not use low-effort AI slop names like `Magic Unicorn Toy for Girls`.
- Do not overuse glitter language.
- Do not create impossible bundles with unclear included items.
- Do not use obviously copied research phrasing from retailers.
- Do not create fake reviews, fake social proof, or fake influencer language.
- Do not create policies that the public AI cannot clearly explain.

## Acceptance Standard
A fresh implementation agent should be able to use only this file to:
- create a believable unicorn demo catalog
- scale the catalog to `500-1000` published products without losing brand coherence
- assign exact launch prices and family price bands
- generate consistent product and collection copy across hero, standard, and long-tail tiers
- produce a coherent image plan without licensing confusion or impossible art requirements
- seed public knowledge docs for storefront AI
- merchandize the store without asking follow-up premise questions

## Research Links
- HalloweenCostumes unicorn costume category and product pricing:
  - https://www.halloweencostumes.com/girls-deluxe-winged-unicorn-costume.html
  - https://www.halloweencostumes.com/girls-magical-unicorn-costume.html
  - https://www.halloweencostumes.com/girls-unicorn-costume.html
- Pottery Barn Kids unicorn pricing:
  - https://www.potterybarnkids.com/products/unicorn-light-up-plush/
  - https://www.potterybarnkids.com/products/designer-soft-animals-doll-collection/
  - https://www.potterybarnkids.com/products/adaptive-light-up-unicorn-tutu-costume/
  - https://www.potterybarnkids.com/products/molly-unicorn-decorative-pillow/
  - https://www.potterybarnkids.com/products/rainbow-unicorn-tea-set/
- Target and Walmart unicorn pricing:
  - https://www.target.com/p/-/A-92401848
  - https://www.target.com/p/-/A-78861944
  - https://www.target.com/p/-/A-92401902
  - https://www.walmart.com/ip/18065321733
  - https://www.walmart.com/ip/474983895
  - https://www.walmart.com/ip/268786063
  - https://www.walmart.com/ip/1626855381
- Claire's accessories and stationery pricing:
  - https://www.claires.com/us/claires-club-light-up-unicorn-wand-156901.html
  - https://www.claires.com/us/claires-club-plush-unicorn-wand-275730.html
  - https://www.claires.com/us/accessories/ages-3-6-accessories/
  - https://www.claires.com/us/holographic-unicorn-stationery-set-914626.html
- Meri Meri party pricing:
  - https://merimeri.com/products/unicorn-party-set
  - https://merimeri.com/products/magical-unicorn-plates
  - https://merimeri.com/products/i-believe-in-unicorns-cupcake-kit
  - https://merimeri.com/products/i-believe-in-unicorns-party-bags
  - https://merimeri.com/products/meadow-unicorns-candles-x-5
- Image licensing and source guidance:
  - https://help.unsplash.com/en/articles/2612315-can-i-use-unsplash-images-for-personal-or-commercial-projects
  - https://help.unsplash.com/en/articles/2612329-releases-and-trademarks
  - https://www.pexels.com/license/
  - https://help.pexels.com/hc/en-us/articles/360042295214-can-i-use-the-photos-and-videos-for-a-commercial-project
  - https://pixabay.com/service/license-summary/
  - https://www.shopify.com/stock-photos/about-us
  - https://www.shopify.com/stock-photos/licenses/shopify-some-rights-reserved
  - https://www.shopify.com/stock-photos/become-a-contributor/
- Shopify help references for media workflow:
  - https://shopify.dev/docs/api/shopify-cli/app/app-execute
  - https://shopify.dev/docs/api/shopify-cli/app/app-bulk-execute
  - https://shopify.dev/docs/api/usage/bulk-operations/imports
  - https://shopify.dev/docs/apps/build/devmcp
  - https://help.shopify.com/en/manual/products/product-media/add-images-variants
  - https://help.shopify.com/en/manual/products/product-media/product-photography
  - https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media
  - https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate
  - https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate
  - https://shopify.dev/docs/api/admin-graphql/latest/mutations/productSet
