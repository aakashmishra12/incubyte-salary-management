# Slice 8: pay assistant (F9)

## User story
As the HR Manager, I want to ask questions about pay in plain words, such as "who is paid furthest above their peers in India?", and get an answer I can check, so that I do not have to know which screen or filter holds the answer.

## Principles
1. **The model never produces a number.** It can only call a few fixed, read-only tools that wrap the insight and employee code that is already tested. Every figure in an answer is copied from a tool result.
2. **Every answer shows what it used**, so the HR Manager can open the same view and check it.
3. **Nothing depends on one provider.** Providers are configured, tried in order, and switched when one hits a limit.
4. **Limits are enforced before money or quota is spent**, and every limit has a clear message.
5. **The rest of the app never depends on the assistant.** With no key configured, the button is not shown and nothing else changes.

## Acceptance criteria
**Answers**
1. A question is answered from the results of one or more tools. The answer, the names of the tools used and a short description of each are returned.
2. The tools are: company overview, breakdown by country, department or level (with filters), pay outliers, and employee search (at most 10 rows per call).
3. Tool results carry amounts as text with the currency, such as "INR 7,100,000". Shares and ratios are computed in code, never by the model.
4. A tool call with invalid arguments returns an error message to the model so it can correct itself. It never throws, and a tool never changes data.
5. Country and department names are accepted in either form ("India" or "IN", "engineering" or "Engineering").
6. One question uses at most 4 rounds of tool calls. Beyond that the answer says the question could not be answered within limits.
7. Follow-up questions work: the last 6 messages of the conversation are sent with each question.
8. Text from the user and text in tool results are treated as data. The system prompt says so, and the model has no tool that can change anything.

**Providers**
9. Providers are Groq, OpenRouter and, optionally, a local Ollama. A provider is on only if its key (or, for Ollama, its model) is set.
10. In Auto mode, providers are tried in the configured order. A provider that is rate limited, down or timing out is skipped, and the next one is tried within the same question.
11. A rate-limited provider is not tried again until its retry time has passed (the time the provider gives, otherwise 60 seconds). A provider that rejects the key or the model name is not tried again for an hour, and the problem is written to the server log.
12. Each provider has a daily budget of model calls, counted on every attempt, failed ones included. A provider at its budget is skipped until midnight UTC.
13. The HR Manager can choose a provider by hand. A chosen provider is the only one tried. If it is unavailable, the answer says so and suggests Auto.
14. The answer says which provider replied.

**Limits**
15. Each visitor can ask 20 new questions per hour. All visitors together can ask 300 per day. Both numbers are settings.
16. A refused question gets status 429, says which limit was reached, and says when to try again, in the message and in the Retry-After header.
17. A refused question does not use up anything else, and a question that hits the daily limit does not use up the visitor's hourly allowance.
18. A repeated first question is answered from a cache and costs nothing. The cache is cleared automatically when any employee data changes, so a cached answer is never out of date. Entries last one hour at most, and the cache holds at most 100 answers.
19. A cached answer is marked as cached. Cached answers do not count towards either limit.
20. If every provider is unavailable, the answer is status 503 with a plain message, and the rest of the app keeps working.

**Safety**
21. Provider keys exist only in the server's environment. They are never sent to the browser, written to the log, or included in any error message.
22. The question is limited to 500 characters, an answer to about 700 tokens, and a provider call to 30 seconds.
23. Error details from providers are logged on the server and never returned to the browser.

**In the browser**
24. A round button at the bottom right opens a side panel. It is shown only when the server reports that the assistant is set up.
25. The panel offers example questions, a provider choice (Auto and each set-up provider, with its current state), a counter of questions left this hour, and the sources under each answer.
26. Each limit and failure has its own message, in plain words. Typed text is kept when a question fails.
27. The conversation lives in the panel only and is gone on reload. Nothing is stored.

## API
- `GET /api/assistant/status` returns `{ enabled, providers: [{ id, label, state }], limits: { perVisitorPerHour } }`.
- `POST /api/assistant/ask` with `{ question, history?, provider? }` returns `{ answer, sources, provider, cached, remainingThisHour }`.

## Notes
- Limits are held in memory, so they reset when the server restarts. That is acceptable for a demo and is listed under what I would add next.
- Visitors are told apart by IP address. Behind a web server, the server must be told to trust it (`TRUST_PROXY`), otherwise every visitor looks the same.
- Open models can still misstate a figure they were given. The sources under each answer exist so a person can check.
