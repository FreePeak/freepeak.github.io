---
title: "xdev: how I built a lightweight and fast agent coding CLI"
date: 2026-09-16T15:49:05+07:00
draft: false
author: "Free Peak"
tags: ["ai", "coding", "golang", "tui", "developer-tools", "agent"]
categories: ["Technology", "AI"]
description: "Seven days rewriting a coding agent harness in Go: one 20MB binary, ~16MB idle RSS, 4 core tools, a system prompt under 1000 tokens. Real numbers, real bugs, and the things I deliberately did not build."
summary: "I use omp, opencode and Claude Code every day, and I got more and more annoyed by how heavy they are. This is the story of the 7 days I spent writing xdev: reading the pi/omp architecture, porting the data model to Go, fighting the terminal UI, and the numbers I measured on my own machine — 20MB binary, ~16MB RAM, 40ms startup."
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

> **Before you read:** every number below I measured on my personal machine (macOS, Apple Silicon) on 2026-09-16, with the command written out. Yours will differ. I am not comparing agent quality — only weight.

## 1) It starts with a stupid question

That afternoon I had 3 terminal tabs open: one running omp, one Claude Code, one opencode. All three were "thinking".

I opened `htop`.

I sat there looking at the colour bars and asked myself a very stupid question: **what does a tool for writing code actually need to keep in memory?**

Not a terminal app. Not an editor. A loop: send text to a model, get text back, call a tool, repeat.

I answered it, and once I had answered it I couldn't unsee it. So I wrote xdev. 7 days, 403 commits.

This is what happened in those 7 days: what I read, what I decided, where I was wrong, and what I measured.

## 2) Measure first

I am not writing this to say the other tools are bad. omp and Claude Code are two things I use daily, and without them I would never have thought about writing my own.

Their problem, for me, is not features. It is **the price of features**.

Here is what I measured on my machine:

| Tool | Binary | `--version` (avg of 5) | Data dir |
|---|---|---|---|
| xdev | 20 MB | 0.040 s | 144 MB |
| omp | 186 MB | 0.091 s | 5.7 GB |
| Claude Code | 210 MB | 0.060 s | 1.1 GB |
| opencode | 144 MB | 0.358 s | 155 MB |

Binary size: `ls -lL ~/.local/bin/xdev`. Timing: a 5-iteration loop calling `--version`, summed with `time.time()`. I don't have `hyperfine`, so my numbers are crude — but crude enough to see the gap.

The binary column is the interesting one. omp, Claude Code and opencode are all **real Mach-O binaries**, not scripts. But run `strings` on all three and you meet the same relative: `bun-v1.4.2`, `bun-v1.4.3`, `bun-v1.3.14`. What you download is not their program — it is their program **plus** an entire JS runtime packed inside.

20MB versus ~200MB for the same job. This is not a "who codes better" contest; Go versus TS is not the reason. The reason is **whether you need that runtime inside your binary at all**, when most of its work is waiting on the network.

## 3) Go to school first: pi and omp

I did not invent the design. I sat down and read, and after reading I realised I no longer needed to be clever.

**pi** (github.com/earendil-works/pi) is a TypeScript coding agent harness by Mario Zechner, and it is what changed my mind. Its philosophy fits in a few lines I had to sit still after reading:

- **A system prompt under 1000 tokens**, including tool descriptions. Reason: frontier models are RL-trained to understand coding agents. 10,000 tokens of instructions is dead weight you carry.
- **Exactly 4 core tools**: `read`, `write`, `edit`, `bash`. Four is enough.
- **YOLO by default.** No permission theater. Because the *read data + execute code + reach the network* trifecta cannot be contained by prompting or pattern rules. If you want containment, contain it with a container or a micro-VM, not with a message.
- **No built-in todo tool.** Models get confused by state that a tool manages. Want a task list? Write `TODO.md`.
- **Hand-roll the LLM layer** instead of using an SDK. Because the world only has **4 wire APIs** that matter: OpenAI Completions, OpenAI Responses, Anthropic Messages, Google GenAI.

**omp (Oh My Pi)** is a fork of pi, and it is what I actually use every day. omp adds a lot of genuinely useful things: a Rust N-API layer for grep/glob/AST/PTY, a shared filesystem-scan cache, an in-process extension system, MCP, a subagent hub, compaction with 6 trigger paths, and a very disciplined session tree.

The price: a JS runtime as the floor, extensions loaded **in the same process**, event queues with no bound, and **the whole session living in memory**. On my machine `~/.omp` has swollen to 5.7 GB.

And here is the single most important decision of the 7 days, in one line:

> **Port the data model. Don't port the code.**

The JSONL session tree (append-only + one leaf pointer), the unified stream contract, how context is rebuilt, compaction, the OutputSink, the frame-plan TUI — all of it is design that my own field usage had already stomped on for months. It is correct. My job was to copy the **semantics** (keeping entry names identical so existing tooling still reads them), not to copy the implementation of the JS era.

The research I wrote during those 7 days lives in `docs/research/`: 19 files dissecting omp, pi, Claude Code, opencode, hermes, fx — with a per-feature verdict table: what to port, what to drop, what to port differently and **why**. `docs/parity-delta.md` records every place I deliberately differ from omp, including the omp flags I **accept for compatibility but that mean nothing** (like `--no-pty`, because my bash tool is pipe-based).

## 4) Architecture: what I chose, and what I deliberately did not build

Module path `github.com/FreePeak/xdev`, Go 1.25, **CGO-free**, one static binary, exactly 5 direct dependencies (`tcell`, `go-runewidth`, the MCP Go SDK, `yaml.v3`, `modernc.org/sqlite`).

### The session is an append-only JSONL tree with a leaf pointer

No entry is ever mutated or deleted. Branching is just **moving a pointer**. Context is rebuilt by walking parent links. The format is inspectable — you can `jq` my session files, and I never had to ship a viewer.

This is a semantic port from pi/omp, and it is the part of the design I sleep best about. Because it allows something a "state lives in memory" harness cannot: **look back and argue with the past**.

### Everything is bounded

Queues are bounded. Buffers are bounded. The session window is bounded. The output sink is bounded.

Concretely: `debug.SetMemoryLimit(100MB)` (overridable with `XDEV_MEMLIMIT`), and when the live heap reaches **85%** of that, the agent **forces compaction** instead of waiting for the token threshold.

The practical meaning: a runaway turn degrades into "compact now", not into an OOM kill. Backpressure is a feature, not a bug.

I measured ~16MB RSS at boot. 30–70MB estimated for a normal working session, worst case pinned under 100MB. This is the one number where I admit I have not measured enough: **I have not run a genuine 200k-token session to the bottom.** The 100MB figure is design plus real tests, not a measurement of the worst case.

### 4 core tools, and the rest is optional

Prompt + 4 tools sits under 1000 tokens, and here I don't trust my own word — I **test the limit**:

```go
// cmd/xdev/prompt_test.go
const maxPromptTokens = 1000

if tokens := len([]rune(got)) / 4; tokens >= maxPromptTokens {
    t.Fatalf("system prompt is ~%d tokens (budget %d): %d chars across %d tools"+
        " — trim a description or make a deliberate PRD change", ...)
}
```

Estimating tokens as `runes / 4` is crude. I know. But it is a **gate**, not a ruler — its purpose is to force me to amend the PRD consciously every time I want the prompt to grow, instead of letting it grow quietly.

`grep`, `glob`, `lsp`, `eval`, `browser`, `debug`, `computer`, `tts`, `task`... all exist, but they are the layer added after the core 4 already stood. Totals: 544 Go files, ~90k lines excluding tests, ~63k lines of tests — **tests are 41% of the codebase**.

### Things I deliberately did not do

Saying what you won't do matters more than saying what you did:

- **No permission theater.** No popup asking "xdev wants to run `ls`?". YOLO by default, and the harness only *documents* sandbox patterns (`docs/reference/container-and-sandbox.md`) instead of building a paper wall.
- **No PTY in the bash tool.** Pipe-based. omp's `--no-pty` flag is accepted for script compatibility and is... a deliberate no-op, recorded in the parity delta.
- **No in-process extension loading.** Extensions run as **subprocesses** talking a JSONL handshake. An extension crashing must not be allowed to kill the agent. What I lose: custom in-process renderers — an extension only **declares** a spec (`card` | `table` | `tree`), the host renders it, and a malformed spec degrades to plain text.
- **No claiming to be a clone.** omp v18.1.17 ships 131 `omp://` doc pages; I diffed `omp --help` against `xdev -h` mechanically and wrote down every gap, with reasons.

## 5) The TUI: where I spent the most time

This is the part I most want to talk about, because it is where I was wrong most often.

### tcell, not bubbletea

bubbletea is pretty, easy, well documented. But its Elm model **allocates a lot**, and in a TUI receiving thousands of streamed tokens per second, allocation churn is exactly what stutter is.

tcell is rawer, faster, lower-allocation — and omp's frame-plan model ports cleanly onto it. The trade: you manage everything yourself. I managed everything myself.

### Frame plan: three states of a block

Every frame is: mandatory chrome (editor/status/HUD/overlay) + `TerminalFramePlan { history?: {id, rows}, viewport: rows[] }`.

And transcript blocks have **three states**:

| State | Meaning | On resize |
|---|---|---|
| **active** | still mutable, lives in the viewport | redraw |
| **settled** | finalised, **can reflow** | reflow, until capacity pressure |
| **committed** | pushed into the terminal's real scrollback | no longer my business |

The insight I arrived at the expensive way: draw the *viewport*, not the *session*. The commit `perf(tui): draw the viewport, not the session; trim aged tool output first` is the commit I wish I had written on day one.

### Resize is the most hateful thing about terminals

Alt-screen (`?1049h`) is only for overlays; for the transcript, any line scrolled off screen goes into the **terminal's real scrollback**. The reason is simple: once I can no longer see it, there is no reason for it to occupy my RAM.

The consequence: when the terminal resizes, my cursor is no longer where I think it is. I have to ask the terminal which row I'm on via a DSR anchor and rebuild. `DSR-anchor resize recovery` was in the PRD from the start, and it is among the most painful lines of text I have ever written.

### The four TUI bugs I remember

**Bug 1 — a real freeze.** `fix(tui): the tree selector could own the keyboard while painting nothing — a "frozen TUI" with a live process`. A selector that rendered **nothing** while still **holding the keyboard**. The user sees a hang; the process is alive. The nasty part: every signal I had for "is the process alive" said fine.

**Bug 2 — self-deadlock.** `fix(tui): picker draw must not re-lock a.mu — self-deadlock hung every draw with content`. Drawing re-locked an already-held lock. Hung **every** frame that had content.

**Bug 3 — a modal that cannot paint must close.** `fix(tui): a modal that cannot paint must close, and cancel hits the turn`. I used to leave the modal open when it couldn't paint. Correct behaviour: if you can't draw it, it disappears. A modal you cannot see but which still eats keystrokes is a trap.

**Bug 4 — the scroll hint painted over content.** `fix(tui): the scroll hint was painted over the first transcript row`. Small. But you see it the first time you open the tool.

After the first three, I added a watchdog: **any UI-loop iteration over 5 seconds dumps goroutine stacks** to `~/.xdev/agent/dumps/` (dump capped at 1MB).

Reason: the three hangs I just described, without a dump I could only guess. And guessing about a hung TUI is a waste of time. I happily pay one goroutine to never guess again.

### The mouse: the thing I redid and redo

There is no spec for mouse behaviour in a TUI. There is only a feeling of "wrong". And I had to answer that feeling 5 times in 4 hours:

```
23:19  fix(tui): Shift hands the drag to the terminal, mid-stroke too
01:07  feat(tui): mouse selection covers the whole screen and stays visible
01:51  feat(tui): one mouse drag can select past the screen
02:19  feat(tui): the modal picker answers the mouse, like omp's SelectList
02:40  feat(tui): click-to-focus on the live-agent roster
```

The first one stung: the user presses Shift to copy using the **terminal's own** selection, and I have to release the pointer mid-drag — even when they're halfway through selecting. No design document teaches you that detail. Only using it does.

The last one is funny: I had built an agent roster panel controllable only by keyboard. In a terminal, in 2026.

### Theme: 66 colour tokens

I ported the Grok CLI theme system (`GrokNight`/`GrokDay`, switching automatically via `OSC 11`), and made **all 66 colour tokens** mandatory — spelled exactly as omp spells them, so an omp theme file paints xdev's chrome unchanged. One token missing is a failing test, not a "later".

I spend all day inside this TUI. Letting it wear the terminal's default colours was not survivable. This is a cost I paid voluntarily, and I think it was worth it.

## 6) Testing a thing that only exists as text

Sounds silly. But my TUI renders **text**, and text is not something anyone can diff by eye with discipline.

So most of my TUI tests are **character-line tests**: build a frame on a simulation terminal, then compare the text.

- **Keymap** (10 tests): every action must resolve, `ChordOf` must go the right way, a corrupt user keymap file must fall back to defaults rather than crash, `/hotkeys` must show **every** action, and a remap must actually change behaviour.
- **Chrome** (15 tests): the status row must say where you are, not list its own keys; the HUD meter must show `used/total` of the live context; the session clock must re-base when the session changes, and when there is no anchor it must **hide itself** rather than display `00:00`.
- **Composer**: `Up`/`Down` in a multi-line draft must walk **visual rows**, not logical lines — obvious until your editor meets a wide character.
- **No hangs**: `draw_hang_test.go` has 5 tests that build frames on a simulation terminal under a timeout — a selector must not own the keyboard while painting nothing, a modal that cannot paint must close. `tree_test.go` pins the self-deadlock too: draw must not re-lock the app mutex. The three bugs above, now locked in a cage made of code.

63k lines of tests, many of which only say "this line must be identical to yesterday". They cost maintenance. But every time I refactored the renderer, they were the only thing that let me refactor without fear.

## 7) The thing models were born to surprise me with

One change during the build I'm particularly fond of: `an unparseable tool call is an error result, not a dead run`.

Before, if the model returned a tool call whose arguments wouldn't parse, the turn **died**. That simple, and that stupid.

After: it becomes a **tool error** that flies back up to the model, and the model fixes it. One error-handling line turned into a self-healing loop. I didn't make the model smarter; I just stopped cutting it off mid-sentence.

Same idea in `edit arg-repair + freshness guard`: repair arguments when they're repairable (models are often off-by-one on line numbers), but if the file changed since the agent read it, **stop and say so** — don't overwrite.

Those two are my whole philosophy about harnesses: patch what a machine can patch, stop where patching means losing data.

## 8) Three things I learned

**One: "lightweight" is not cutting features. It is cutting the runtime.**

xdev ended up with a subagent hub, MCP client, LSP, memory backend, E2E collab, web search, browser over CDP, a DAP debugger. 35 packages under `internal/`. I did not cut features. I cut the runtime that came bundled, and pushed the heavy things into **child processes**.

**Two: discipline does not live in intention. It lives in tests.**

Every number I bragged about at the top has something holding it in place. 1000 tokens? `prompt_test.go` fails if I write longer. 66 colour tokens? `m12_test.go`. Help must name every subcommand and must not leak `@both`? `usage_test.go` — born after 13 subcommands vanished from the help at the same time.

Discipline without a test stops being discipline after 3 days and 100 commits. It becomes a memory.

**Three: don't port code. Port the *why*.**

Where I ported both the implementation and the reason, I was fast. Where I ported an implementation without its reason, I spent half a day discovering I had carried along somebody else's decision.

`docs/parity-delta.md` is therefore worth as much as the code. It is where I wrote: omp does A, I do B, and **why B**.

## 9) Try it if you want

```bash
curl -fsSL https://raw.githubusercontent.com/FreePeak/xdev/main/scripts/install.sh | sh
```

Then `xdev setup` to create `~/.xdev/agent/`, point `models.yml` at a gateway you already have, and:

```bash
xdev tui                       # interactive mode
xdev "find every place in this repo that logs a password"
xdev --resume 01a0             # resume by session-id prefix
```

`xdev bench --turns 5 --model @smol` measures TTFT and decode p50/p95 for your provider — if you're curious about my numbers.

Repo: `github.com/FreePeak/xdev` (Apache-2.0).

## 10) Closing

The question "what does a tool for writing code need in memory" now has an answer for me: about 16MB, 4 tools, and a session format `jq` can read.

The rest of the 7 days was learning how **not** to do more than that.

And the other 200MB in the tools you use? Not their fault. They chose breadth over weight, and for a lot of people that choice is right.

It's just that this morning I opened 3 terminal tabs that were "thinking", looked at `htop`, and for the first time didn't feel like I was burning RAM to wait for a model to answer.
