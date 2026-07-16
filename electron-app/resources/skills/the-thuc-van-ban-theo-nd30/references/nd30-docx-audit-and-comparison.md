
# ND30 DOCX audit and comparison

Use this reference for requests to review an uploaded Word document.

## Minimum audit sequence

1. Detect the document family.
2. Check core ND30 layout rules.
3. Check family-specific title and block logic.
4. Compare against a chosen template if one exists.
5. Summarize issues by severity: fail, warn, info.

## Core command

```bash
python scripts/check_nd30_docx.py file.docx
```

## With explicit type

```bash
python scripts/check_nd30_docx.py file.docx --document-type cong-van
```

## With template comparison

```bash
python scripts/check_nd30_docx.py file.docx   --document-type quyet-dinh-truc-tiep   --template assets/templates/quyet-dinh-template.docx   --json report.json
```

## What the quick audit checks

- section margins against the ND30 ranges
- presence of Quốc hiệu and Tiêu ngữ
- number/symbol line
- địa danh + date line
- likely title block by document family
- Kính gửi or Nơi nhận patterns when relevant
- sampled explicit font assignments
- placeholder fields if the file is actually a template

## How to report findings

Prefer this structure:

1. Detected document type.
2. Whether the document is broadly usable as-is.
3. Hard failures first.
4. Warnings and polish fixes next.
5. Template differences last.

Do not claim legal perfection from the quick audit alone. Use wording like "quick ND30 structural audit" or "layout/form audit" unless you have also manually reviewed the rendered pages.


## v5 audit buckets

Report findings in four buckets when possible:
- document-family correctness
- nd30-format compliance
- template similarity
- layout risk
