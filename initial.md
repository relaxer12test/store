i have job application challange to write heres are there instructions : 

```
Growth Capital Developer Takehome

The Task

Build an application that allows a user to interact with their Shopify data through an AI agent

Requirements

Test Shopify app
Test dev store
AI Agent that can query this data on demand

Stretch Goals and Nice to Have’s

Please feel free to add as many additional features as you would like. Here are some ideas to get you started, but as by no means a complete list:

Generative UI and Dashboarding
Document Parsing
Shopify Liquid page generation 
Additional data sources 

We’re asking you to create a Shopify app and development store as part of this exercise.

This is intentionally designed to go a bit beyond AI-assisted coding, we’re looking to see how you navigate the full process end-to-end.

The prompt is intentionally broad to give you room to showcase your approach. We’re especially interested in how you think through problems, the decisions you make, and the overall quality and completeness of your work.

```


lets brain storm and plan out what we should build. on top of these requirements i also have strong tehcnial preferences

we use tanstack start and its official starter
we use convex as backend
we use tanstack extensively wherever needed liek tanstack ai we gonna need tanstack table,form,pacer
we must use tanstackplus skill and get nice bento and other marketing goodies from it
we must use react component flow properly we shoudn't shit out componeents willy nily must be all composable and reusable
we must use tanstack form in composable maner like <mainform <maininput and so on we shoudn't use any hooks outside forms itself
we must use tailwindplus catalyst components i will copy them myself when time comes
for hosting we use cloudflare workers and for files we must use cloudflare R2 with convex r2 plugin, for queue or workflow we still use convex
for merchant and shopper auth we should use Shopify's real embedded app auth model, not better-auth
we may still use better-auth with convex for our own internal or staff-only tooling such as `/internal`, but that must stay separate from merchant and shopper auth
