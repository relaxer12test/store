# Remotion Media Contract

Place deployed-environment capture files in `public/remotion/footage/` using these exact names:

- `shopper-recommendation.mp4`
- `shopper-cart-plan.mp4`
- `shopper-refusal.mp4`
- `merchant-dashboard.mp4`
- `merchant-approval-flow.mp4`
- `merchant-document-grounding.mp4`
- `merchant-traceability-close.mp4`

The sales-pitch composition is wired to these paths and will automatically use the real footage when the files exist.

To recapture the full clip set from the deployed storefront and merchant app, run:

```bash
npm run video:capture:sales-pitch
```

Until clips are added, the composition renders labeled placeholder slates so the timeline, captions, and motion design stay reviewable without inventing fake product footage.
