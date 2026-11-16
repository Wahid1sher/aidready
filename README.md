# AidReady

**Document disaster damage and build an aid or insurance claim, even with no signal.**

After a flood, fire or storm, families have to prove what they lost: every item, a price and photos, often before a hard deadline and often with no power or cell service. AidReady turns photos of a damaged home into an itemised claim packet, using hybrid AI that runs on the phone when it can and in the cloud when it helps.

Built for the Google **#BuildHybridAI** hackathon with **Firebase AI Logic** hybrid inference (Gemini Nano in Chrome plus Gemini in the cloud).

## What it does

- **Scan each room.** Photograph every wall. Gemini Nano, on the device, lists the damaged items it sees and suggests a replacement price. Every item is editable.
- **Works with no signal.** Photos are saved on the phone (IndexedDB). With on-device AI they're read right away; without it, they wait and are read automatically when signal returns. The app installs as an offline PWA.
- **Extra costs with a receipt scanner.** Photograph a hotel or store receipt; the amount and date fill in. Dates are kept only when printed on the receipt.
- **Claim checkup.** Plain rules find what's missing (no deadline, items without prices, rooms without photos). The AI then writes the three most important next steps.
- **Claim packet.** A cover letter written by Gemini, an itemised inventory by room, extra costs, photos, a total, print or PDF, and a CSV for insurer portals.
- **Deadline countdown** from the date on your official aid notice. The app never guesses deadlines.
- **Backup and restore**: the whole claim and its photos in one file, so a lost phone doesn't lose the claim.
- **English and Spanish**, including the AI's output.

## Hybrid AI, and why

| Task | Where it runs | Why |
| --- | --- | --- |
| Reading room photos | On-device first (`PREFER_ON_DEVICE`), or `ONLY_ON_DEVICE` when cloud is off | Photos of a home are private, and disaster zones often have no signal |
| Reading receipts | On-device first | Same |
| Next steps from the checkup | On-device first | Short text task, works offline |
| Cover letter | Cloud first (`PREFER_IN_CLOUD`), on-device when offline | Best writing quality; it only sees totals and placeholders |

Privacy choices:
- **Your details never go to the AI.** Your name, address, insurer and claim number are filled into the letter on the device.
- **Cloud switch.** The status pill has one: turn it off and photos never leave the phone.
- **Untrusted output is checked.** Model output is cleaned before it's used: prices are range-checked, dates are validated, and every number in the letter comes from the claim itself, not from the model.
- **Stall handling.** If Gemini Nano stops responding, the app marks it as stalled, offers a **Try again** button, and recovers on the next successful call.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web app config
npm run dev
```

You need:
- a Firebase project with **Firebase AI Logic** and **App Check** (reCAPTCHA Enterprise) turned on;
- for on-device AI, Chrome with Gemini Nano (the Prompt API) available.

Other commands:

```bash
npm test        # 30 unit tests: totals, deadlines, CSV, backup checks, checkup rules, AI output cleaning, translations
npm run build
```

## Tech

React 18, TypeScript, Vite, Firebase AI Logic (`firebase/ai` hybrid inference), App Check, IndexedDB, a service worker, Vitest.

## License

Apache 2.0, see [LICENSE](LICENSE).

> Estimates are replacement-cost estimates to help fill in a claim, not appraisals. The checklist is general guidance, not the rules of any specific aid program.
