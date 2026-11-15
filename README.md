# DealForge AI

A local MVP that turns business agreement text into a reviewed legal PDF draft, a compiled Solidity milestone escrow contract, and an interactive payment simulation.

## Run locally

Requires Node.js 22.12+ and npm.

    npm ci
    npm run dev

Open http://127.0.0.1:5173. The API runs on port 3001. Start with **Try an example**, analyze it, fill in acceptance criteria and governing jurisdiction, then generate both contracts.

For a single-server build:

    npm run build
    npm start

Open http://127.0.0.1:3001.

## Claude integration

Copy .env.example to .env, set ANTHROPIC_API_KEY, and restart the server. ANTHROPIC_MODEL is configurable. The key stays on the server; agreement text is sent to Anthropic only when Claude mode is enabled. No live Claude request was tested during initial implementation because no API key was supplied.

Without credentials, the app explicitly uses a conservative local parser. It recognizes the sample format:

    Client Name (client) hires Contractor Name (contractor) to perform services for $12,000 USD.
    1. Discovery: $3,000, due December 1, 2026.
    2. Delivery: $9,000, due January 10, 2027.

The local parser leaves missing terms blank and requests clarification. It is not a general language model. Every extracted term is editable. USD is the supported settlement currency.

## Included

- Text entry and .txt import with input limits.
- Local extraction and optional Claude extraction with structured response validation.
- Party, scope, payment, milestone, deadline, acceptance, governing-law, revision, and IP review.
- Clarification prompts and clause risk cards.
- Server validation of required terms, calendar dates, cent precision, and matching milestone totals.
- Legal PDF and Solidity downloads generated from the same reviewed payment terms.
- Solidity compilation through solc, plus automated execution tests of the generated template.
- Plain-language clause explanations.
- Virtual escrow funding, client approval and release, and mutual cancellation refunds.
- Agreement library persisted in this browser, with reopen and delete.
- Responsive desktop and mobile layouts.

## Verification

    npm test
    npm run build
    npx playwright install chromium
    npm run test:e2e

Node tests cover extraction, missing terms, unsupported currencies, mismatched amounts, invalid dates, Solidity compilation, and deployed contract behavior on an in-process Ganache EVM. They verify unauthorized calls, failed funding, duplicate releases, full milestone payout, and mutual-cancellation refunds. Browser tests cover the complete flow, downloads, persistence, simulation, and mobile overflow. Browser screenshots are written to artifacts/.

Generation compiles each output and validates its payment terms. EVM execution tests run through npm test; the UI does not imply that a security audit has taken place.

## Contract behavior and limits

MilestoneEscrow.sol uses a trusted, six-decimal ERC-20 USD token. The deploying account is the client; the constructor accepts a token address and a distinct contractor address. The client approves the escrow's allowance on the token and calls fund(). Only the client can call release(index), once per milestone. Each party can call consentToCancellation(); two consents refund all unreleased funds to the client.

Deadlines, acceptance, legal jurisdiction, and IP provisions remain off-chain. The PDF explains that separation. A token's price, issuer, and implementation must be verified before deployment; fee-on-transfer or rebasing tokens are unsupported. This MVP does not deploy contracts, connect real wallets, collect signatures, or resolve disputes. Generated documents are unsigned drafts and generated Solidity is unaudited.

This is a single-user local workspace. There is no account system, team invitation backend, shared storage, or production hosting. Generated agreements remain in browser localStorage; ungenerated drafts are not persisted. Download documents to retain a separate copy.

The test-only Ganache dependency includes legacy bundled dependencies with known npm audit findings. Ganache is never imported by the app server or browser bundle. Use this as a local prototype; update or replace that test environment before production hardening.

## Code map

- src/App.jsx: workflow, saved agreement library, simulation, and dialogs.
- src/styles.css: responsive interface.
- server/engine.js: extraction, terms schema, legal clauses, Solidity generation, compilation.
- server/index.js: API, PDF generation, and production static serving.
- tests/: extraction, deployed escrow, and browser tests.
