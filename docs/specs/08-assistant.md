# Slice 8: pay assistant (F9)

This spec was written first and then amended twice: after calling the real providers (decision D-021), and after the adversarial review (docs/REVIEW.md). The criteria below describe what the code does now.

## User story
As the HR Manager, I want to ask questions about pay in plain words, such as "who is paid furthest above their peers in India?", and get an answer I can check, so that I do not have to know which screen or filter holds the answer.

## Principles
1. **The model never produces a number.** It can only call a few fixed, read-only tools that wrap the insight and employee code that is already tested. Code enforces what it can (the tools are read-only, amounts arrive as text, lists are capped). What it cannot force, that the model copies figures and never works them out, is checked afterwards: a figure in an answer that is not in the data the answer used is flagged.
2. **Every answer shows what it used**, so the HR Manager can open the same view and check it.
3. **Nothing depends on one provider.** Providers are configured, tried in order, and switched when one hits a limit.
4. **Limits are enforced before money or quota is spent**, and every limit has a clear message.
5. **The rest of the app never depends on the assistant.** With no key configured, the button is not shown and nothing else changes.

## Acceptance criteria
**Answers**
1. A question is answered from the results of one or more tools. The answer, the names of the tools used and a short description of each are returned.
2. The tools are: company overview, breakdown by country, department or level (with filters), pay outliers, and employee search (at most 10 rows per call).
3. Tool results carry amounts as text with the currency, such as "INR 7,100,000". Shares and ratios are computed in code, never by the model.
4. A tool call with invalid arguments, or with an argument the tool does not have, returns an error to the model that lists the allowed arguments, so it can correct itself. A tool never changes data.
5. Country and department names are accepted in either form ("India" or "IN", "engineering" or "Engineering"), and empty values mean "not set".
6. People who have left are left out of every tool unless the question asks for them (employee search has a status argument for that).
7. One question uses at most 4 calls to a model. Tools run in at most the first 3 of them, because the results of a fourth round would never be read. Beyond that, the answer says the question could not be answered within limits, and is not remembered.
8. Follow-up questions work: the last 6 messages of the conversation are sent with each question, each shortened to 1,500 characters. The server accepts earlier messages of up to 8,000 characters, because an answer can be about 6,000 characters long.
9. Every figure in an answer is looked up in the data the answer used (the tool results, the question, the conversation and today's date). Small whole numbers are ignored. A figure that is not found is named in a note added to the answer, and the answer is not remembered. An answer with figures but no tool call also says that no company data was looked up.
10. Text from the user and text in tool results are treated as data. The system prompt says so, and no tool can change anything.

**Providers**
11. Providers are Groq, Gemini, OpenRouter, NVIDIA and, optionally, a local Ollama. A provider is on only if its key (or, for Ollama, its model) is set. The default order is Groq, Gemini, OpenRouter, NVIDIA, Ollama, and settings can change it.
12. In Auto mode, providers are tried in order. A provider that is rate limited, down, refusing or timing out is skipped, and the next one is tried within the same question.
13. How long a failing provider is left alone depends on what went wrong. A rate limit: the time the provider gives (60 seconds if it gives none, never more than one hour). An outage or timeout: 30 seconds. A refused request (status 400, 402, 409, 413, 422 and similar): 5 minutes, and logged. A wrong key or model (401, 403, 404): one hour, and logged. A longer block is never replaced by a shorter one.
14. Each provider has a daily budget of model calls, counted on every attempt, failed ones included. A provider at its budget is skipped until midnight UTC. The defaults are below each provider's published free limit.
15. The HR Manager can choose a provider by hand. A chosen provider is the only one tried. If it is unavailable, the answer says so and suggests Auto. A question aimed at one provider can use up that provider's daily budget for everyone (see D-022).
16. The answer says which provider replied. Gemini's "thought signature" is sent back to Gemini only, with a placeholder for tool calls another provider made.

**Limits**
17. Each visitor can ask 20 new questions per hour. All visitors together can ask 300 per day. Both numbers are settings. Visitors are told apart by address, and every address in one IPv6 /64 is one visitor.
18. A refused question gets status 429, says which limit was reached, and says when to try again, in the message and in the Retry-After header.
19. A refused question does not use up anything else. A question that no provider could answer is given back to the visitor and to the day, once, and only for the hour and day it was charged to.
20. A repeated first question is answered from a cache. The cache is cleared automatically when any employee data changes, so a cached answer is never out of date. Entries last one hour at most, and the cache holds at most 100 answers. A cut-off answer, a given-up answer and an answer with unchecked figures are not remembered.
21. A cached answer is marked as cached and counts towards neither limit.
22. If every provider is unavailable, the answer is status 503 with a plain message, and the rest of the app keeps working.

**Safety**
23. Provider keys exist only in the server's environment. They are never sent to the browser, written to the log, or included in any error message.
24. The question is limited to 500 characters (at least 2), an answer to 1,500 tokens (hidden thinking counts against it, so a reply that stops at the limit is detected and labelled as cut off), and a provider call to 30 seconds.
25. Error details from providers are logged on the server and never returned to the browser.
26. Behind a web server, the server listens only on this machine and trusts the proxy setting, so nobody can choose their own visitor identity with a header.

**In the browser**
27. A round button at the bottom right opens a side panel. It is shown only when the server reports that the assistant is set up. The page leaves room below its content so the button never covers a row or a submit button.
28. The panel offers example questions, a provider choice (Auto and each set-up provider, with its current state), the questions left this hour (as the server counts them, refreshed when the panel opens and after every question), and the sources under each answer.
29. The conversation is a live region, so a screen reader reads new answers, the thinking message and errors.
30. Each limit and failure has its own message in plain words. A failed question returns to the box unless something else was typed meanwhile. Enter sends, Shift+Enter starts a new line, and Enter while text is being composed with an input method does not send.
31. The conversation lives in the panel only and is gone on reload. Nothing is stored.

## API
- `GET /api/assistant/status` returns `{ enabled, providers: [{ id, label, state, availableAgainAt? }], limits: { perVisitorPerHour } | null, remainingThisHour }`.
- `POST /api/assistant/ask` with `{ question, history?, provider? }` returns `{ answer, sources, provider, providerLabel, cached, remainingThisHour, unverifiedFigures }`.

## Notes
- Limits are held in memory, so they reset when the server restarts. That is acceptable for a demo and is listed under what I would add next.
- Visitors are told apart by IP address. Behind a web server, set `TRUST_PROXY`, otherwise every visitor looks the same.
- Open models can still misstate a figure they were given. The sources under each answer, and the check on figures, exist so that a person can notice.
