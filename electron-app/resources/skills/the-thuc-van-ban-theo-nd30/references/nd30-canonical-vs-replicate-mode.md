# Canonical vs Replicate Mode

## Canonical mode

Choose canonical mode when:
- the user wants a document correct under ND30 even without a source mẫu
- the source sample is weak, inconsistent, or obviously non-compliant
- the request is about **creating the right type of document**, not about mimicking an internal style

Canonical mode uses the ND30 content spec as the main source of truth.

## Replicate mode

Choose replicate mode when:
- the user explicitly says to follow a source mẫu
- the user uploads a DOCX shell and wants a corresponding new document
- the institution has a local style tradition that should be preserved as long as ND30 is not violated

Replicate mode still checks the result against ND30.

## Safe decision rule

- If the sample is good and the user asked to follow it, use replicate mode.
- If the sample conflicts with ND30 in a material way, either:
  - switch to canonical mode, or
  - stay in replicate mode but explicitly report the conflict.

## Delivery rule

Never silently preserve an ND30 violation just because a sample contained it.
