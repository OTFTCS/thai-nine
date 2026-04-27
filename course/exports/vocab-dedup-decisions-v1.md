# Vocab Dedup Decisions (v1)

Every row below is a Thai token that appears in `new_vocab_core` in two or more lessons.
Default annotation has been stamped into the v2 CSV `notes` column so the validator is green.
Nine's review of this table overrides the default; tick one box per row:

- `sense-shift` means the token has a genuinely different meaning in the later lesson (true homograph).
- `spaced-review` means it is the same word reintroduced on purpose; consider moving it to `review_vocab_required` for cleanness.
- `move` means the token should be deleted from `new_vocab_core` in the later lesson and appended to that lesson's `review_vocab_required`.

| lesson_id | thai | first_seen | default | sense-shift | spaced-review | move |
|---|---|---|---|---|---|---|

Total: 0 flagged entries (0 sense-shift, 0 spaced-review).
