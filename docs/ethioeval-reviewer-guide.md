# EthioEval: guide for language reviewers

EthioEval decides which AI model is allowed to do which kind of task in your language. A model can be good at conversation and poor at formal documents, so we test nine task types separately.

## Writing test items

1. Write as a real user in your community would write: everyday words, real situations (business, school, farming, health questions, government forms, church and community events).
2. Never translate from English. Never ask an AI to write the items.
3. Write at least 60 items for each task type. Use the template in `evals/items/_TEMPLATE.jsonl`.
4. For Tigrinya, mark each item `ti-ET` or `ti-ER` and use that spelling convention.
5. Leave `status` as `draft`. Another reviewer marks it `reviewed`; you cannot review your own items.

| Task type | What to write | How it is scored |
| --- | --- | --- |
| conversation | Everyday questions and follow-ups | Rubric 1 to 5 |
| reasoning | Word problems, planning, arithmetic, with one correct answer | Correct or not |
| instruction_following | Requests with clear rules: length, format, tone, words to avoid | Automatic checks |
| document_generation | Formal letters, reports, proposals, applications | Rubric 1 to 5 |
| research | Questions needing current facts from the web | Rubric 1 to 5, citations checked |
| technical | "Explain how...", "Make me a small app that..." | Tests plus rubric |
| file_understanding | Questions about an attached PDF, Word file or photo of a document | Correct or not |
| retrieval | Searches over a set of project files | Correct passage found or not |
| project_consistency | Long conversations that must keep one language, spelling and set of terms | Automatic checks plus sample review |

## Scoring with the rubric (1 to 5)

Score each of these, then give an overall score:

- **Accuracy**: are the facts and the answer right?
- **Fluency**: does it read like a fluent native speaker wrote it?
- **Spelling and script**: correct letters and spelling convention for the locale?
- **Register and terms**: right level of formality and the right words for the subject?
- **Invented words**: note any word that does not exist. One invented word in a formal document lowers the score to 3 or below.

5 = a native speaker would send it as is. 4 = small fixes. 3 = usable after editing. 2 = mostly wrong or unnatural. 1 = unusable.

About 20% of items are scored by two reviewers so we can check that scores agree.

## Also needed from reviewers in Phase 0

Confirm the search spelling rules in `packages/i18n/src/normalize.ts`: which letters should be treated as the same when searching (for Amharic: ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ; for Tigrinya currently only ሰ/ሠ and ጸ/ፀ).
