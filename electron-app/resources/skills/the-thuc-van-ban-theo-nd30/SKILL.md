---
name: the-thuc-van-ban-theo-nd30
description: create, revise, audit, and improve vietnamese administrative docx and xlsx files according to nghị định 30/2020/nđ-cp. use when the user needs to draft or check official administrative documents, compare layout with a standard mẫu, repair title block, quốc hiệu-tiêu ngữ, kính gửi, nơi nhận, chữ ký, run a qwenpaw-default-model language review, apply safe rewrites back into docx, or rebuild a clean docx from a scan without using tesseract ocr.
---

# Thể thức văn bản theo NĐ30

## Overview

Use this skill for Vietnamese administrative Word and Excel deliverables that must comply with Nghị định 30/2020/NĐ-CP.

This skill now supports **two explicit creation modes** and one audit mode:

1. **Canonical ND30 mode**: build the document from a structured ND30 content spec when there is no source mẫu, or when the user's priority is legal/administrative correctness.
2. **Replicate mode**: read a user sample or built-in mẫu, extract a reusable **format profile**, then generate a new corresponding document that imitates that mẫu while still checking against ND30.
3. **Audit mode**: read an uploaded DOCX, detect its likely document family, compare it with ND30 rules, and optionally compare it with a user template or built-in mẫu.

Use this skill for **what the document must be** under ND30, and use a general DOCX skill only for low-level OOXML surgery or purely visual repair.

## Quick start

## Dependency bootstrap

Before using the scripts, check the runtime and install only missing libraries if needed:

```bash
python scripts/ensure_python_deps.py
python scripts/ensure_python_deps.py --install-missing
```

If `soffice` or `pdftoppm` are missing, explain that render or visual diff is unavailable in the current environment.

## LLM-only language and logic review

After format review, run a second model-only pass for spelling, wording, logic, consistency, and normalization suggestions. See `references/nd30-language-review-and-template-admission.md`.


1. Identify whether the user needs:
   - a new ND30 Word document,
   - a new related Excel workbook,
   - an audit of an uploaded DOCX,
   - a reusable format profile from a sample DOCX,
   - or a new document generated from a user sample or a built-in mẫu.
2. Choose the mode:
   - **canonical** if correctness under ND30 matters more than imitating a source file,
   - **replicate** if the user explicitly wants to follow a sample/template.
3. Read only the smallest relevant reference.
4. Validate the structured content spec.
5. Generate, audit, or compare.
6. For DOCX, render and visually inspect when possible.
7. When layout fidelity matters, prefer clone-and-patch over rebuilding, then run visual diff.
8. Deliver only the requested final artifacts.

## Workflow decision tree

### A. New ND30 Word document in canonical mode

Use this when the user says things like:
- soạn mới văn bản theo nghị định 30
- tạo công văn/quyết định/thông báo đúng thể thức
- chưa có mẫu nhưng cần file chuẩn

1. Choose the document family with `references/nd30-document-type-matrix.md`.
2. Build a canonical ND30 **content spec**.
3. Validate it with `scripts/validate_nd30_content_spec.py` or `scripts/validate_nd30_spec.py`.
4. Generate with `scripts/create_nd30_docx.py`.
5. Render with `scripts/render_docx.py` and inspect if possible.

### B. Replicate mode from a user sample or built-in mẫu

Use this when the user says things like:
- đọc thể thức mẫu và làm theo
- bắt chước mẫu này để tạo văn bản mới
- lấy file người dùng hoặc file trong thư mục mẫu để soạn tương ứng

1. Prefer the **user sample DOCX** if provided.
2. Otherwise choose a matching built-in mẫu from `assets/templates/`.
3. Extract a reusable **format profile** with `scripts/extract_docx_template.py`.
4. Build a matching ND30 **content spec** for the new document.
5. Prefer `scripts/clone_patch_docx.py` when the source mẫu already contains placeholders or stable anchors.
6. Otherwise generate with `scripts/generate_from_profile_and_content.py --mode replicate`.
7. Audit the result with `scripts/check_nd30_docx.py`.
8. Render and inspect the pages if possible, then use `scripts/compare_docx_visual.py` if the user needs a closeness check against the mẫu.

### C. Audit mode for an uploaded DOCX

Use this when the user asks to:
- kiểm tra thể thức
- xem văn bản này đúng loại chưa
- đối chiếu với nghị định 30
- so với mẫu chuẩn hoặc mẫu cơ quan

1. Detect or confirm the intended document family.
2. Run `scripts/check_nd30_docx.py`.
3. If there is a source mẫu or built-in template, compare with that template too.
4. Report findings in three layers:
   - **document-family correctness**
   - **ND30 compliance**
   - **template similarity**
5. If the user wants, fix the document or create a new corrected version.

### D. Create a related Excel workbook

Use this when the user needs an attached table, register, list, or appendix workbook tied to ND30-style administrative work.

1. Choose the workbook family with `references/nd30-attachment-and-register-patterns.md`.
2. Build the workbook JSON spec.
3. Generate with `scripts/create_nd30_workbook.py`.
4. Inspect key headers, sheet names, totals, and row mapping.

### E. Batch generation from Excel

Use this when the user has Excel rows and wants many documents.

1. Confirm the target ND30 document family.
2. If a DOCX template with placeholders exists, use `scripts/fill_docx_template.py`.
3. If the requirement is stronger than placeholder replacement, convert each row to a canonical content spec and use `scripts/generate_from_profile_and_content.py`.
4. Always generate one sample row first before the full batch.

## Template admission workflow

When the user wants the skill to learn from a newly supplied mẫu:

1. audit the mẫu strictly against ND30 and its intended document family
2. summarize fail and warn issues
3. ask whether the user still wants to accept that mẫu if issues remain
4. only then register it with `scripts/register_template_profile.py`
5. preserve warnings so later replicate-mode runs can mention them

## Canonical mode vs replicate mode

### Canonical mode

Choose this when:
- the user did **not** supply a source mẫu,
- a built-in template is only a loose starting point,
- or the output must prefer ND30 correctness over local visual tradition.

In this mode:
- the ND30 content spec is the source of truth,
- built-in templates are optional helpers,
- and `scripts/create_nd30_docx.py` is the default generator.

### Replicate mode

Choose this when:
- the user explicitly wants to follow a particular mẫu,
- there is a source DOCX shell or a built-in mẫu that should be imitated,
- or the user wants the new file to stay close to an internal institutional format.

In this mode:
- the format profile and source DOCX shell matter,
- the output still gets checked against ND30,
- and `scripts/generate_from_profile_and_content.py --mode replicate` is the preferred path.

Do **not** let replicate mode keep a visually similar but ND30-wrong structure without warning the user. If the sample itself violates ND30, say so clearly.

For generated DOCX files, prefer generators that apply pagination controls (`keepNext`, `keepLines`, `widowControl`) and heading emphasis rules. When a page ends with only 1-2 sparse lines or a heading is stranded at the bottom, treat that as a layout-quality issue even if the raw ND30 fields are present.

## Required source hierarchy

When rules compete, follow this precedence:

1. The user's explicit legal or administrative requirement.
2. Nghị định 30/2020/NĐ-CP and its annexes.
3. This skill's ND30 references and built-in mẫu.
4. User sample/template conventions.
5. Generic DOCX automation convenience patterns.

A user sample can influence appearance, but it must not silently override a mandatory ND30 rule.

## Structured artifacts used by this skill

### 1. Canonical ND30 content spec

A JSON object describing the actual document or workbook content and required ND30 fields.

Use this for:
- canonical ND30 generation,
- audit remediation,
- and reproducible batch generation.

See `references/nd30-content-spec-schema.md`.

### 2. DOCX format profile

A JSON object extracted from a sample DOCX that captures reusable information about:
- margins and page metrics,
- styles and fonts,
- table structures,
- numbering,
- headers and footers,
- placeholders,
- and an ND30-oriented structural signature.

Use this for:
- comparing a file against a mẫu,
- deciding whether a source DOCX is suitable for replication,
- and replicate-mode generation.

See `references/nd30-format-profile-schema.md`.

## Supported Word document families

Use one of these `document_type` values:

- `cong-van`
- `nghi-quyet-ca-biet`
- `quyet-dinh-truc-tiep`
- `quyet-dinh-gian-tiep`
- `van-ban-co-ten-loai`
- `cong-dien`
- `giay-moi`
- `giay-gioi-thieu`
- `bien-ban`
- `giay-nghi-phep`
- `phu-luc`
- `ban-sao-giay`
- `ban-sao-dien-tu`

## Supported workbook families

Use one of these `workbook_type` values:

- `so-dang-ky-van-ban-di`
- `so-dang-ky-van-ban-den`
- `so-theo-doi-giai-quyet-van-ban-den`
- `muc-luc-ho-so`
- `muc-luc-van-ban`
- `danh-sach-noi-nhan`
- `phu-luc-bang`

## Commands

Validate canonical ND30 content specs:

```bash
python scripts/validate_nd30_content_spec.py input.json
python scripts/validate_nd30_spec.py input.json
```

Extract a reusable DOCX format profile:

```bash
python scripts/extract_docx_template.py source-template.docx profile.json
```

Audit an uploaded DOCX:

```bash
python scripts/check_nd30_docx.py input.docx
python scripts/check_nd30_docx.py input.docx --document-type cong-van --template assets/templates/cong-van-template.docx --json report.json
```

Generate from a profile plus content spec:

```bash
python scripts/generate_from_profile_and_content.py profile.json content.json output.docx --mode auto
python scripts/generate_from_profile_and_content.py profile.json content.json output.docx --mode replicate --source-docx source-template.docx
```

Generate directly in canonical mode:

```bash
python scripts/create_nd30_docx.py input.json output.docx
python scripts/create_nd30_workbook.py workbook.json output.xlsx
```

Fill a DOCX template from JSON or Excel:

```bash
python scripts/fill_docx_template.py template.docx output.docx --data-file data.json
python scripts/fill_docx_template.py template.docx output.docx --xlsx source.xlsx --sheet Sheet1 --row 2
python scripts/fill_docx_template.py template.docx output_dir --xlsx source.xlsx --sheet Sheet1 --all-rows
```

Render for visual QA:

```bash
python scripts/render_docx.py output.docx --output_dir tmp/rendered_pages
```

## Final delivery checklist

Before delivering:

- correct document or workbook family selected
- correct mode selected: canonical vs replicate
- if replicate mode was used, the source mẫu was actually extracted or compared
- ND30 content spec validated
- if the source mẫu violates ND30, the report says so explicitly
- title, trích yếu, numbering, signer block, nơi nhận, and appendix notes are coherent
- workbook headers and row structure match the chosen pattern
- output format matches the request
- Word layout inspected if rendering was available

## Reference map

Read only what the current step needs:

- `references/nd30-source-map.md` → quick map from ND30 annexes to skill responsibilities
- `references/nd30-core-rules.md` → mandatory layout, formatting, and signature logic
- `references/nd30-writing-and-abbreviations.md` → viết hoa and abbreviation rules
- `references/nd30-document-type-matrix.md` → choose the right form for the purpose
- `references/nd30-template-guidance.md` → Word-family-specific guidance and required fields
- `references/nd30-attachment-and-register-patterns.md` → workbook families and sheet/header rules
- `references/nd30-template-fill.md` → placeholder conventions and Excel-to-Word mapping rules
- `references/nd30-template-replication-and-source-docx.md` → source-template and imitation workflow
- `references/nd30-docx-audit-and-comparison.md` → quick audit and template comparison workflow
- `references/nd30-format-profile-schema.md` → format profile JSON schema
- `references/nd30-content-spec-schema.md` → canonical ND30 content spec schema
- `references/nd30-canonical-vs-replicate-mode.md` → when to choose each mode
- `references/using-with-docx-and-office-automation.md` → combination rules with generic skills
- `references/nd30-language-review-and-template-admission.md` → LLM wording/logic review and template acceptance workflow
- `references/internal-template-library.md` → internal fine-tuned mẫu library and source corpus
- `scripts/validate_nd30_content_spec.py` → preferred validator for canonical content specs
- `scripts/extract_docx_template.py` → profile extractor
- `scripts/check_nd30_docx.py` → ND30 audit and template comparison helper
- `scripts/generate_from_profile_and_content.py` → mode-aware generator from profile + content
- `scripts/create_nd30_docx.py` → canonical Word generator
- `scripts/create_nd30_workbook.py` → workbook generator
- `scripts/fill_docx_template.py` → placeholder template filler from JSON or Excel
- `scripts/render_docx.py` → DOCX render helper for visual QA
- `assets/examples/` → ready-to-adapt content specs, profiles, and workbook examples
- `assets/templates/` → built-in mẫu DOCX and workbook shells
- `assets/profiles/` → built-in extracted profile JSON files for the mẫu DOCX in `assets/templates/`


Optimize pagination and reduce widows/orphans on an existing DOCX:

```bash
python scripts/optimize_docx_layout.py input.docx output.docx --tightness balanced
```


## Internal fine-tuned templates

This package includes a fine-tuned internal library built from real agency documents in `assets/templates/internal/` with extracted profiles in `assets/profiles/internal/` and the original supporting corpus in `assets/internal-corpus/`. Prefer these when the user wants closeness to the institution's actual layout, but still run ND30 audit and the LLM language review branch.
