<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

we shoudn't use inline imports
we should use @ imports only

for any fix you always alwaays step back and re-evalaute fundamentals of given thing and always seek better simplified way to implement anything

agent should never ever run dev server it will be already run or ask me to run it

if we write any tests it must be e2e tests i don't care about any other tests and if thats not possibel skip writing them all to gather
e2e must only be used on dev server 3000 and dev server must always be run by developer not LLM
we dont use prettier check npm run format

we don't edit cata/\* components they are libraries if we think issue is there we are wrong
