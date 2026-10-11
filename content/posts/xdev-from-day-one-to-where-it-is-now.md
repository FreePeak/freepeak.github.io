---
title: "xdev from day one: 743 commits, 33 days, and what actually shipped"
date: 2026-10-11T22:00:00+07:00
draft: false
author: "Free Peak"
tags: ["ai", "coding", "golang", "tui", "developer-tools", "agent"]
categories: ["Technology", "AI"]
description: "A full retrospective on building xdev: 743 commits in 33 days, milestone table M0-M15, what a turn actually does, the Telegram gateway, and the process rules that survived contact with real daily use."
summary: "I wrote the first xdev commit on 2026-09-09 and the 743rd on 2026-10-11. This is everything between: the research-first day, the four-day sprint that closed M0-M15, the weeks where every user report became a PRD stamp, the Telegram gateway, and the numbers I can measure today - 21.8 MB binary, 12 ms startup, 128k lines of Go, 7 direct dependencies."
ShowToc: true
TocOpen: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowShareButtons: true
ShowCodeCopyButtons: true
cover:
    image: ""
    alt: "xdev terminal UI"
    caption: ""
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/FreePeak/Labs/tree/main/content"
    Text: "Suggest Changes"
    appendFilePath: true
---

> **Before you read:** every number here comes from a command I ran on this machine on 2026-10-11 — `git log`, `wc -l`, `go.mod`, `xdev --version`, `/usr/bin/time -l`. I wrote the commands into the text so you can argue with them. Nothing is estimated unless I say it is.

I already wrote [the story of the first seven days](/posts/xdev-how-i-built-a-lightweight-and-fast-agent-coding-cli). This is the different story: what happened *after* the origin myth — the whole arc, from the first commit to the 743rd, and what the thing actually is now.

If you only want one fact: **the first commit is 2026-09-09 and it is a document, not a program.**

## 1) Day one started with reading, not coding

```
2026-09-09 10:36  dcf378d  docs: initial PRD, README, and omp/pi Go-rebuild research
2026-09-09 11:29  05b9352  docs: extend PRD/README to full omp feature parity; add M9-M14 issues
2026-09-09 13:06  7e516be  docs: fix stale non-goal — theme engine is in scope (M12 CORE)
2026-09-09 13:40  ba1b809  docs: Claude Code cross-check — research, verdicts, and evidence
2026-09-09 15:22  000a14c  docs: second-wave cross-harness research — omp/pi/CC/opencode/hermes internals
2026-09-09 17:27  a024b62  feat: MVP — providers, session core, agent loop, 4 core tools, print mode
```

Six documentation commits before the first line of Go. That was not virtue, it was fear. I had just spent weeks reading that my own daily tools were 200 MB binaries wrapping a JS runtime, and the temptation was to start typing immediately and be proud of a `main.go`. What I did instead was write down what each of the five peer harnesses actually does — pi, omp, Claude Code, opencode, Hermes — with a verdict per feature: **port**, **port differently**, **reject**. All of it landed in `docs/research/`, which is now 29 documents.

By that evening there was a working MVP: providers, session core, agent loop, four tools, print mode. One more commit opened the TUI. A month later, that research directory is the single reason the project did not become a pile of one-off decisions.

## 2. The first four days are a third of the project

Here is the actual rhythm of the thing, from `git log --format='%ad' --date=short | sort | uniq -c`:

![xdev commits per day from 2026-09-09 to 2026-10-11](/images/posts/xdev-from-day-one-to-where-it-is-now/commit-cadence.svg)

Read that chart carefully, because it is the story:

- **Day 1 (11 commits).** Research, PRD, MVP, TUI. Milestones **M0–M4** — skeleton, provider layer, session core, agent loop, terminal UI — closed the same day.
- **Days 2–4 (24, 116, 132 commits).** **M5–M15** closed on 2026-09-11 and 2026-09-12: compaction and failover, RPC mode, subprocess extensions, the memory-hardening audit, model resolution and auth, session UX, the agent system, memory and skills, the extended tool set, the v2 modes, and the full-parity tail.
- Days 5–13. The **field-driven pass**: I used the thing daily, and every annoyance got fixed the day it annoyed me (more on this in §3).
- Days 14–18. The flat week — 4 commits, then 1. I was not working on xdev. Worth mentioning, because retrospectives usually delete this part.
- Days 20–32. The **daily-driver pass**: TUI polish, multi-session tabs, the sidebar, and on the last day the Telegram gateway.

**283 of 743 commits landed in the first four days.** That is 38% of the project in 12% of the calendar. Then the shape changes completely: no more big bang, just 4 to 30 commits a day of nervous small fixes in a UI I was using for hours at a time.

The longest gap between two commit days is three days. Zero `Revert "` commits in the entire history, which is what a repo looks like when the research was done first.

## 3. The device that made this possible: the PRD as a diary

Here is the process fact I am proudest of, and it is measurable:

| | |
|---|---|
| Commits that touch `docs/PRD.md` | **364** |
| ...of those, commits that *also* touch a `.go` file | **266** |
| `*Last updated:*` stamps inside the PRD | **466** |
| Mentions of "user report" in the PRD | **23** |
| Total PRD length | 3,508 lines |

The rule was simple and absolute, and it is written into `CONTRIBUTING.md`:

> Any change to scope, architecture or status updates `docs/PRD.md` **in the same commit**.

Not "in the same PR". In the same commit. So when I run `git log -- docs/PRD.md` I get a diary, and when I read a stamp like this one, the bug is still readable months later:

```
*Last updated: 2026-10-06 (fix/stop-at-the-report — user report:
 "my xdev alwasy in the overthinking mode which is for the simple
 task or just research task..."):* the symptom was one bug; the
 deepdive turned it into three
```

Twenty-three of those stamps quote me, verbatim, being annoyed at my own tool. That is the highest-value artifact in the repository — higher than the code, because the code I can rewrite, and the reason I wrote it I cannot reconstruct.

It also keeps the milestone table honest. The PRD §4 table has one row per milestone M0–M15, with scope, exit criterion, status, and the issue numbers. There is no `TASKS.md` in the repo, on purpose: **tasks are GitHub issues**, the PRD is a status summary. 194 issues are open right now, mostly P2 breadth.

## 4. What it is made of

![xdev lines of non-test Go per internal package](/images/posts/xdev-from-day-one-to-where-it-is-now/lines-by-package.svg)

```bash
$ find . -name '*.go' -not -path './.worktrees/*' | wc -l
816
$ # non-test lines
128,179
$ # test lines
102,085
$ find . -name '*_test.go' | wc -l
458
```

**44% of the Go in this repo is tests.** 458 test files against 358 source files. For a project where "does it still work" is answered by looking at a terminal, that ratio is the whole safety net.

`go.mod` has **seven direct dependencies**: `tcell`, `go-runewidth`, the official MCP Go SDK, `golang.org/x/sys`, `golang.org/x/term`, `yaml.v3`, and `modernc.org/sqlite` (used in exactly one file, to read Cursor's local IDE state for `xdev connect cursor`). No CGO, so `CGO_ENABLED=0` cross-compiles to six platforms from one machine. Everything else — `git`, `rg`, `fd`, `ast-grep`, `gh`, `python3`, `/usr/bin/security` — is shelled out to and probed, never required.

And the numbers I re-measured today, on the installed release:

| | |
|---|---|
| Binary | **21.8 MB** |
| `xdev --version`, median of 5 | **12 ms** |
| Peak RSS for that run | **21.0–21.6 MB** (footprint 11.1–11.4 MB) |
| Same measurement, omp / Claude Code / opencode | **198.6 MB / 229.5 MB / 171.9 MB** |

A month in, the gap held. That was the hypothesis I was testing on day 1, and it survived contact with 743 commits of feature work — because the constraint was enforced in code, not in intent:

```go
// internal/memlimit
const DefaultLimitBytes = 100 << 20  // hard worst-case ceiling: 100 MB
const HighPressure      = 0.85       // live heap fraction that forces compaction
```

## 5. One turn, end to end

This is what actually runs when you type something. Every box is a real file.

![xdev turn flow: prompt to provider, tool dispatch, session append, termination](/images/posts/xdev-from-day-one-to-where-it-is-now/turn-flow.svg)

Four things in that diagram are decisions I would defend in a review:

**The tool batch is genuinely concurrent, and order is restored after the join.** `internal/agent/loop.go` runs one goroutine per tool call under a semaphore of 6 (`MaxToolWorkers = 6`, which the PRD budgets as "~4–8"). Then, *after* `wg.Wait()` and on the single goroutine, it walks the results in model order to feed the repeat-call guard. That ordering is deliberate: the loop the guard exists to catch is a sequence of calls *as the model wrote them*, not as my workers happened to finish them.

**Compaction has multiple triggers, and two of them ignore tokens entirely.** The token trigger fires at the context window minus a reserve, where the reserve is at least 20% of the window — so ~80% is where a 200k session compacts. `internal/agent/compact.go` adds two more: a heap-pressure trigger at 85% of that 100 MB limit (so a runaway transcript degrades into "compact now" instead of being OOM-killed), and an idle trigger. Behind them sits a *ladder* — `threshold`, `overflow`, `promotion` are the triggers; `handoff`, `snapcompact`, `shake`, `soft` are the products, and the first one that yields a retained context wins. `snapcompact`, `shake` and `soft` are deterministic: no model call, so they work offline. `remote` is a documented no-op that says so instead of dressing a local summary up as a provider-native one.

**The session is append-only, and the leaf is a pointer.** Not one entry is ever mutated. A fork moves a pointer; context is rebuilt by walking parent links; `jq` reads the file. This is the one design decision I ported wholesale from pi/omp's data model rather than reinventing, and the interop test in `internal/session/interop_test.go` runs against a real omp session fixture to keep the format honest. `xdev -from-claude` and `-from-codex` import another harness's transcript and continue it.

**Bounded everything, including the load path.** The M8 audit measured a 50k-entry session loading to a 130 MB heap — over budget. The fix (`ce8fcae`, 2026-09-11) was *windowed materialization*: entries before the latest reset or compaction boundary are dropped at load, indexes are rebuilt in batches, and the file on disk is untouched. The bound is on memory, not on history.

The system prompt next to all of this is deliberately tiny: `SystemPromptBase` is 1,889 characters (about 470 tokens at the crude 4-chars-per-token estimate), and there is a **test** that fails if the total prompt plus every tool description crosses 1,000 tokens. It is a gate, not a ruler — it exists so that growing the prompt requires a conscious PRD amendment instead of happening by accident.

## 6. What the tool surface actually is now

`xdev` has **42 subcommands** (the map in `cmd/xdev/main.go`) and, today, this many tools the model can call. The core four get the eager schema; the long tail is behind a deferred catalog (`tool_search` → `tool_describe` → `tool_call`), which is why the prompt budget above is still possible:

| Layer | Tools |
|---|---|
| The eager core | `read` `write` `edit` `bash` |
| Search and structure | `grep` `glob` `ast_grep` `ast_edit` |
| Run things | `eval` (a persistent Python kernel; `.ipynb` as cell blocks) `lsp` `debug` (DAP: dlv, debugpy, lldb-dap) `browser` (CDP) |
| Reach out | `web_search` `github` `gmail` `security_scan` `computer` `tts` `generate_image` `typesafe` |
| Delegate | `task` (subagents with their own tool allowlist) `hub` `send_message` `inbox` `vibe_status` `advise` `propose` |
| Remember and undo | `learn` `recall` `retain` `reflect` `checkpoint` `rewind` `notes` `new_context` |
| Plan and organise | `todo` `goal` `ask` `schedule_create` `schedule_list` `schedule_delete` |
| The bridge | `tool_search` `tool_describe` `tool_call` |

Plus anything from an MCP server (the official Go SDK, stdio and HTTP) or a subprocess extension speaking JSONL on stdio with a per-event timeout and SIGKILL. Both land in the same registry as the built-ins, so a foreign tool is policy-gated and output-sunk exactly like `bash`.

Eight wire formats, so any OpenAI-compatible gateway works: `anthropic-messages`, `openai-completions`, `openai-responses`, `azure-openai-responses`, `openai-codex-responses`, `google-generative-ai`, `google-vertex`, `gemini-cli`. Subscriptions work through the browser OAuth flow (`xdev login claude`), and `xdev connect` writes from a generated ~200-host catalog so you rarely hand-write a provider block.

## 7. The part I did not plan: it moved into my pocket

The last *cluster* of the 743 is the interesting one, because a month of building a terminal UI ended by making the terminal optional:

```
2026-10-11 5bd5f1b feat(gateway): register the command menu in the Telegram client (#626)
2026-10-11 77258d2 feat(gateway): format messages for the phone like Hermes does (#625)
2026-10-11 dee214d fix(gateway): a transport error never carries the bot token (#624)
2026-10-11 bc003ec fix(gateway): a 409 no longer kills the daemon (#623)
2026-10-11 53bd7c5 feat(gateway): the Telegram bridge — background daemon, setup, LeanKG memory (#622)
```

`xdev gateway` is a background daemon that long-polls Telegram and runs the *same* agent loop against the *same* session store, per chat. Five commits, one day, and the four after the first are all defect work:

- a `409` from Telegram used to kill the daemon. It shouldn't: Telegram terminates an old long poll when a new `getUpdates` arrives, so a 409 means *someone poked the API* — including me, checking it by hand. So it now paces and continues, and a *real* rival poller still shows up as a 409 on every poll.
- a transport error was printing the bot token into the log.
- model markdown is converted to Telegram's HTML subset rather than MarkdownV2, and falls back to plain text when the parser rejects the parse.
- the bot registers its command menu, so `/help` exists where a user looks for it.

This is the part I would not have predicted from the day-1 plan. The harness did not get better because I added features. It got better because I started driving it from places I did not design it for, and the seams held: one session core, one agent loop, one tool registry, and a different front door.

## 7.5. How I tested a thing that only exists as text

The repo has **12 `scripts/tui-*-drive.py`** files. They are not unit tests. They drive the real binary in a real pty and assert on the frames it paints — tab policy, sidebar ink, sticky padding, overlay width, thinking colour, subagent transcripts. Plus `scripts/tui-shot.py`, which runs `xdev tui` in a detached tmux session, asks tmux for the pane *with its colors* (`capture-pane -p -e`), repaints that cell grid as an SVG and rasterizes it.

Nothing about the screenshots in this series is mocked up. Every cell came from what the TUI painted.

That test layer exists because of a specific class of bug I hit repeatedly: **a modal that paints nothing but still eats keystrokes**, or a draw path that re-locks a mutex it already holds and freezes the whole UI while the process looks perfectly alive. `gh` says 194 issues are open right now, and a large share of the closed ones are that shape. When the artifact is text, diffing text is the only review that scales.

## 8. Five rules I would keep if I started over

1. **Research before `main.go`.** Six doc commits before one line of Go paid for itself all month. Write down what the peer tools actually do, with a verdict per feature — not "they're heavy" but "they do A, I will do B, because C".
2. **One document that must move with the code.** Same *commit*, not same PR. It converts a sprawling history into a readable diary and it is the only reason I can still explain a two-week-old decision.
3. **Encode the budget as a failing test.** "Under 1,000 tokens" is a wish. `t.Fatalf` when it goes over is a constraint. Same for the memory ceiling, same for the theme's mandatory tokens.
4. **Bounded everything, and prove it under load.** The memory bug that mattered was not in the agent loop; it was in the session *loader*, at 50k entries. If a queue, a cache, a window or a sink can grow with its input, it will.
5. **Fix the shared function once.** The gateway's four post-ship commits were all at seams — the poll loop, the log line, the formatter. That is only possible because there was one of each.

## 9. What is still not good

Saying this is more useful than the numbers:

- **The worst case is not measured.** I have not driven a genuine 200k-token session to its floor and watched RSS. The <100 MB is design plus a lot of real sessions, not a proof of the deepest case.
- **The PRD is 3,508 lines and has duplicated sections** — `## 5. Key decisions` and `## 6. Links` each appear twice. The first time the count went to two was 2026-10-02 (`42b235f`, a sticky-prompt commit that added 997 lines to the PRD). I know. It is on the list, and there is a diff sitting there that says so.
- **194 open issues**, most of them P2 breadth. Breadth is exactly what I said I would not chase on day 1, and the "all of them" directive on day 3 re-scoped the skip list. That tension is in the PRD by name, not hidden.
- **No CI gate on pull requests.** You run `gofmt -l .`, `go vet ./...`, `go test -race ./...` and the six-platform cross matrix yourself. That is a deliberate choice for a single-maintainer repo and it will not survive a second regular contributor.
- **Memory recall is not policy.** Recall ranks against the last user turn only, caches for 60 seconds and is capped at ~4 KB — so a "never do X" rule that lives only in memory gets truncated or discounted. Standing conventions belong in `AGENTS.md` or `RULES.md`. I measured this and wrote the decision down, which is how I found out.

## 10. Try it

```bash
curl -fsSL https://raw.githubusercontent.com/FreePeak/xdev/main/scripts/install.sh | sh
xdev setup      # ~/.xdev/agent/, a starter config, and next steps
xdev            # the TUI
```

Then `xdev connect` to reach ~200 hosts with one command, `xdev login claude` if you have a subscription, or point `models.yml` at any OpenAI-compatible gateway you already run.

Repo: `github.com/FreePeak/xdev` — Apache-2.0, 743 commits, one author, 33 days.

## Closing

The first post ended with a question about what a coding tool needs in memory. This one ends with a different observation: five of the last six commits of the 743 are about a Telegram gateway I did not plan on day 1, and the absolute last one is about compaction — the quiet thing that keeps a long session alive.

That is what a full arc looks like, I think. Four days to build the thing you imagined, and then weeks of finding out it wants to be something slightly different — and keeping the seams clean enough that it can.
