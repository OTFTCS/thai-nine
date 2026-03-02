# Stage 0 — Context Loader
Load known vocabulary/grammar from prior lesson `script-master.json` files in the same module.
Return strict JSON with:
- lessonId
- priorLessons[]
- knownVocabulary[] (thai/translit/english)
- knownGrammar[]
Do not invent prior knowledge not present in source artifacts.
