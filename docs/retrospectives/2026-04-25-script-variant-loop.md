# Retrospective, 2026-04-25, script-variant refinement loop

Session goal: design and implement a 4-variant script-refinement loop for YouTube episodes (`youtube/tools/draft_variants.py`, `judge_variant.py`, `synthesize_round.py`, 4 SKILL.md files, 8-dim rubric). Plan was approved, 4 parallel implementation agents shipped code. Then 5 production runs failed in a row before the pipeline actually generated a variant.

Every failure was something a reviewer should have caught. Writing them down so the next loop doesn't repeat them.

## 1. Implementation agents wrote subprocess code without running `cli --help`

The agent that wrote `draft_variants.py` invoked `claude -p --system <prompt>`. The flag is actually `--system-prompt`. The agent that wrote `judge_variant.py` used `--system-prompt @<file>`, which is API SDK syntax, not CLI syntax (the right flag is `--system-prompt-file <path>`). Both flags would have surfaced in 5 seconds with `claude --help`.

**Rule:** For any tool that shells out to an external CLI, the implementation agent's brief must say "first run `<cli> --help` and paste the relevant flags into your context, then write the subprocess call." Same goes for code review: a reviewer asked to validate a subprocess invocation must verify each flag against `--help` output.

## 2. Nobody flagged that `claude -p` is agentic by default

The whole point of `claude -p` is one-shot text generation, but without `--tools ""` it loads CLAUDE.md, runs Read/Bash/Grep, and explores the repo. On the very first live run, Claude saw the existing `youtube/examples/YT-S01-E02.json`, decided it was being asked to "reproduce" it, and wrote a prose preamble plus a markdown-fenced copy. On the next run, Claude spent 15 minutes running tools and timed out.

This is a Claude Code-specific gotcha that anyone who has used `claude -p` more than once knows. Three implementation agents and one Plan agent did not flag it. The plan even said "subprocess pattern: see generate_images.py" — but generate_images.py calls Gemini, which has no agentic loop.

**Rule:** When using `claude -p` from a script (i.e. for non-agentic generation), ALWAYS pass `--tools ""` and `--disable-slash-commands`. Treat this as a baseline like `set -euo pipefail` for bash scripts. Encode it in the project skill prompts so future agents don't relearn it.

## 3. The "do not read files" prompt directive was treated as a substitute for `--tools ""`

When the first run produced a Claude that read the existing E02 and reproduced it, my fix was to strengthen the user-turn prompt: "1. Do NOT read any files from disk. 2. Do NOT use Read, Bash, Grep, or any other tool." Claude ignored it. Next run also timed out.

Prompt-level prohibitions on tool use are not enforceable at scale. The model can choose to violate them if the system prompt includes any other instruction that suggests it should. CLI-level flag enforcement is the only reliable answer.

**Rule:** Don't rely on prompt directives for capabilities the CLI can disable. If the CLI exposes `--tools ""` (or equivalent) to physically remove the capability, use it. Prompt-level directives are belt-and-braces, not the primary mechanism.

## 4. `--bare` looked like the right answer but actually requires a different auth path

I tried `--bare` to skip CLAUDE.md auto-discovery. It silently failed with "Not logged in", because `--bare` requires `ANTHROPIC_API_KEY` env var or `apiKeyHelper`, not the keychain OAuth this machine uses. A reviewer who actually read the `--bare` help text would have caught this in 30 seconds. I did not, and burnt one full run on it.

**Rule:** When considering a CLI flag as the answer to a problem, read its full help text including the auth/config requirements before adding it. `claude --help | grep -A 3 <flag>` is the minimum. Better: try the flag with a 1-token smoke test before committing.

## 5. The synthesizer agent never tested with an empty scaffold

`synthesize_round.py` had two bugs that surfaced the moment I ran it on a fresh dry-run scaffold:
- `for vid in variant_ids` iterated over dicts instead of strings, producing log lines like `Loading {'variantId': 'r1-A', 'axes': {...}, ...}` and trying to open `r1/{'variantId': 'r1-A', ...}-judge.json`. Type hint said `list[str]`, runtime had `list[dict]`. Type checker wouldn't have helped because the dict came from JSON.
- Empty `[friction: part-7-drills] _____` placeholder lines were parsed as real friction tags, registering 4 fake friction tags per part on a fresh scaffold.

Both are textbook "what does this do with empty input" bugs. The implementation brief said "tolerate missing annotation files" but didn't say "tolerate template-placeholder content." A code reviewer should have asked: "what happens if I run this on an unmodified scaffold?"

**Rule:** Workflows that consume template/scaffold input must be tested first with the unfilled scaffold, not with hand-crafted real data. This is the equivalent of "what does the form do when the user submits all empty fields."

## 6. Em dashes survived three rounds of agent prompts that explicitly forbade them

The plan, the agent briefs, and the project CLAUDE.md all said "no em dashes." Three of the four implementation agents wrote em dashes anyway, in 21 places across the three Python tools and the rubric prompt. I caught them with a single `grep -n —` across new files after the fact and replaced them with `--`.

The rule was visible. The agents read it. They still broke it. This means the rule needs to be either:
- Mechanically enforced (a pre-commit hook that rejects em dashes in source files), or
- Repeated in the most prominent place in every brief (first sentence, not buried in a "style rules" list)

**Rule:** Style rules that are repeatedly violated need mechanical enforcement, not just documentation. For the em-dash rule specifically, add a pre-commit hook in this repo that rejects `—` in any tracked text file.

## 7. `claude -p` defaults to extended thinking, hangs on long JSON outputs

After fixing tools and the agentic-loop issues, the 5th run STILL timed out at 900s on r1-A. The issue: `claude -p` without `--effort` runs the default model with extended thinking on. The model spends most of its budget on internal reasoning before producing the JSON, then runs out of time generating the actual output. Smoke test with `--effort low --model sonnet` returned a small JSON in 5.6 seconds; same call without those flags would take many minutes or time out.

This is gotcha three for the same CLI. Tools enabled by default, slash commands enabled by default, extended thinking enabled by default. Each one separately ate a production run.

**Rule:** When subprocessing `claude -p` for non-agentic generation, the baseline flag set is `--tools "" --disable-slash-commands --model sonnet --effort low`. Only deviate when the task genuinely needs higher effort or a different model. Document this as a single helper function (`run_claude_oneshot()`) so future tools don't relearn it one flag at a time.

## 8. No code-review agent was dispatched between implementation and smoke test

I ran four implementation agents in parallel, collected their summaries, and went straight to smoke-testing. The smoke test surfaced the bugs above one at a time, requiring 5 production runs to debug. A 10-minute code-review agent dispatched between "implementation done" and "first smoke run" would have caught at least the CLI-flag bug, the empty-scaffold bug, and the em-dash bug.

The `/codex-review-plan` rule fires after plan mode. There is no equivalent rule for "after parallel implementation, before smoke test."

**Rule:** After dispatching parallel implementation agents, ALWAYS dispatch one code-review agent over the resulting files before running the first smoke test. Brief it with: "verify subprocess CLI flags against `--help`; verify error/empty-input handling; verify project style rules; verify the implementation matches the plan's described behavior."

## What worked

- The plan-mode-with-critique-agents pattern was strong. The feedback-architecture critique caught the comment-only annotation pattern, the test-set critique caught the beginner-bias, both materially improved the plan.
- The 4-agent parallel implementation actually delivered the code. The bugs were minor and fixable; the structure was right.
- Once `--tools ""` was set, generation should work. Validating end-to-end now.
