# Adversarial review

After the application was built, I had it reviewed before calling it finished. This document says how, what came out of it, and what was done about it. The review is an artifact of how AI was used here: the same tools that wrote the code were pointed at it, with instructions to try to break it.

## Method
- **Ten independent reviewers**, each an AI agent that owned one dimension and could read the code and run it: the pay rules, the data layer, the API, the assistant's security, the assistant's logic, the web screens, accessibility, test quality, the documentation's claims, and a clean-clone build.
- **Three skeptics per finding**, each trying to refute it from a different angle: reproduce it, trace it through the code and the documented decisions, and judge whether it matters for this project. A finding counted only if at least two of the three agreed.
- **Rules for the agents.** The repository was read-only for them, they could not touch the file with the API keys, call any outside service, or start servers on the development ports. Temporary scripts went to a scratch folder.
- **Test quality was checked by mutation.** One reviewer broke critical lines one at a time in a copy of the code and reported every break that no test noticed.

## What came out
| Dimension | Candidates | Confirmed | Refuted | Not decided |
|---|---|---|---|---|
| Pay rules | 3 | 3 | 0 | 0 |
| Data layer | 3 | 2 | 1 | 0 |
| API | 4 | 3 | 1 | 0 |
| Assistant security | 4 | 4 | 0 | 0 |
| Assistant logic | 10 | 8 | 2 | 0 |
| Web screens | 10 | 10 | 0 | 0 |
| Accessibility | 15 | 15 | 0 | 0 |
| Test quality | 19 | 13 | 0 | 6 |
| Documentation claims | 9 | 9 | 0 | 0 |
| Build and deployment | 7 | 7 | 0 | 0 |
| **Total** | **84** | **74** | **4** | **6** |

Of the 74 confirmed, 4 were rated high, 36 medium and 34 low. The 6 not decided were test gaps whose skeptics ran out of their usage allowance before voting. I checked each myself, and all six were real and are fixed.

## The findings that mattered most
| Finding | What was wrong | What was done |
|---|---|---|
| `PORT` and `DATABASE_FILE` in `.env` were ignored | The settings were read before the file was loaded, and the seed command never loaded it | Settings are a tested function called after loading the file |
| One oversized request could take a provider offline for an hour for every visitor | Any unlisted error status was treated as a wrong key | Only 401, 403 and 404 do that now. Other refusals cool the provider for 5 minutes |
| A long assistant answer made every follow-up fail | The server refused earlier messages over 2,000 characters, but its own answers can be 6,000 | The limit is 8,000 and earlier messages are shortened before they are sent to the model |
| The tools silently dropped filters they did not have | A question about "salary above 5 million" returned everyone | Tools are strict and name the allowed arguments |
| "The model never produces a number" was only half enforced | Nothing checked an answer's figures against the data | Figures in an answer are checked, and unmatched ones are flagged (D-024) |
| `npm run seed` pulled the database from under a running server | It deleted the file | It replaces the data in one transaction and keeps the file |
| The assistant button covered the next-page arrow and submit buttons | No room was left below the content | The page leaves room |
| Muted text, links and input borders failed contrast | The design reference's values are too light | Stronger values, with real ratios asserted by a test (D-025) |
| Several documents claimed things that were not true | The specs were never updated, the review of code was claimed but not done, deployment steps were promised but missing | Corrected, and the README has a deployment section |

All 74 confirmed findings are fixed or recorded as accepted (below). Each fix has a test that failed first or, for gaps in existing tests, was shown to fail when the protected line is broken.

## What was not changed, and why
| Finding | Decision |
|---|---|
| Email uniqueness is case sensitive in the database | Refuted: every writer lower-cases the email first, and no other path writes employees |
| No plausibility limits on pay or dates | Refuted as a defect: the app flags a salary that is a typo as an outlier, and the form shows the percentage before saving. A sanity limit is a possible addition |
| Daily budgets reset at midnight UTC, Gemini's quota resets at midnight Pacific | Refuted: the budgets are deliberately below the limits |
| Empty tool call ids | Refuted: the provider client makes up an id when one is missing |
| The visitor limit counts questions, not model calls | Accepted and documented in D-022, with what would close it |
| The `foreign_keys` setting can be removed without a test failing | Not a defect: the library turns it on by default, so removing the explicit line changes nothing |

## Proving the new tests
After the fixes, 15 critical lines were broken one at a time (the search escaping, a cooldown time, the cache lifetime, the provider timeout, the refund rule, the money rounding, the 80% boundary, a sort direction, the figure check, the wasted round, the leaving date rule, client errors, the proxy binding and the IPv6 grouping). **14 were caught by a test.** The 15th is the foreign key setting above.

## Limits of this review
- The reviewers are AI agents. They read and ran the code, but this is not a penetration test or a security audit.
- They found things I did not, and I ruled out things they reported. Both directions are in the numbers above.
- One reviewer left a stray copy of a dependency folder inside the project, which broke the web tests until I removed it. That is why the rules for the agents now say where they may write.
- The usage allowance ran out near the end of the run, which is why 21 of the 264 agent calls failed. The rest of the results are complete.
