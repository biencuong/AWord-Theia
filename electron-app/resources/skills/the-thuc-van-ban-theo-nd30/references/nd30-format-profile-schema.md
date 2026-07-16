# ND30 Format Profile Schema

Use this file when you need to **extract**, **compare**, or **reuse** the formatting logic of a sample `.docx`.

## Purpose

A format profile is the reusable formatting description produced from a DOCX sample. It captures both:
- **OOXML-derived structure** such as styles, numbering, tables, and header/footer parts
- **ND30-facing signals** such as document-family detection, margins, key lines, and placeholder discovery

Use it for:
- replicate-mode generation
- comparing a user file with a built-in mẫu
- deciding whether a source mẫu is close enough to ND30 to reuse safely

## Top-level shape

```json
{
  "profile_version": "1.0",
  "source_document": "cong-van-template.docx",
  "source_path": ".../cong-van-template.docx",
  "detected_document_type": "cong-van",
  "section_metrics": {},
  "core_flags": {},
  "headers_footers": {},
  "styles": {},
  "numbering": {},
  "tables": [],
  "paragraphs_preview": [],
  "structural_signature": [],
  "placeholder_keys": []
}
```

## Key fields

### `detected_document_type`
Likely ND30 family inferred from the visible title blocks and early structure.

### `section_metrics`
Page size and margin summary in millimetres. Use this for quick ND30 compliance checks.

### `core_flags`
Quick booleans for important ND30 markers such as:
- Quốc hiệu
- Tiêu ngữ
- Số/ký hiệu line
- date/location line
- Nơi nhận/Lưu markers

### `styles`
OOXML style summary keyed by style ID. Includes style type, readable style name, font hints, and paragraph alignment/spacing where available.

### `numbering`
OOXML numbering summary. Useful for article-based or multi-level numbered documents.

### `tables`
Table structure summary including row count, detected column widths, and optional style ID.

### `paragraphs_preview`
Sampled visible paragraphs in body order, including:
- origin path such as body or table cell
- style name
- alignment
- uppercase flag
- sampled font names and sizes
- placeholder detection

### `structural_signature`
A compact top-of-document fingerprint for comparison with another profile. Use it for quick similarity checks, not as a legal proof.

## Recommended usage

1. Extract a profile from the source DOCX.
2. Check whether the detected type matches the intended ND30 family.
3. Compare the profile against ND30 and, if useful, against a built-in mẫu profile.
4. Decide whether to:
   - generate in canonical mode, or
   - generate in replicate mode from the source shell.
