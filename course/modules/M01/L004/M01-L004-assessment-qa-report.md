# Assessment QA Report — M01-L004

Result: PASS

## Quiz coverage
- 15 vocab IDs in script-master.json languageFocus
- 15 vocab IDs covered in quiz-item-bank.json
- All new vocab items have quiz questions (thai-to-english, english-to-thai, fill-translit, context-mcq)
- No unseen vocabulary in quiz — all items come from the lesson's languageFocus

## Flashcard / vocab export coverage
- 15 cards in vocab-export.json matching all 15 languageFocus items
- Tags include M01-L004 and core

## Transliteration consistency
All transliterations match across script-master.json, quiz-item-bank.json, and vocab-export.json:
- ศูนย์ = sǔun, หนึ่ง = nùeng, สอง = sǎawng, สาม = sǎam, สี่ = sìi
- ห้า = hâa, หก = hòk, เจ็ด = jèt, แปด = bpàaet, เก้า = gâo, สิบ = sìp
- เบอร์อะไร = ber à-rai, ฉันอายุ...ปี = chǎn aa-yú ... bpii, ห้อง = hâwng

## Notes
- สาม appears twice in languageFocus (once as digit in s2, once as pronunciation focus in s6) with distinct vocabIds. Both are covered in the quiz. This is acceptable since they serve different pedagogical purposes.

## Remaining concerns
- None.
