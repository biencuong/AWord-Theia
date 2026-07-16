# ND30 Content Spec Schema

Use this file when you need to create a new ND30 document or workbook from structured data.

## Purpose

The content spec is the **content source of truth**. It describes what the document says and which ND30 family it belongs to.

Use it for:
- canonical ND30 generation
- batch generation from Excel
- regenerate-after-audit flows
- replicate mode when you want a new document to follow a mẫu but still change the content safely

## Core rules

- The JSON root must be an object.
- It should describe **one document** or **one workbook**.
- Use `document_type` for Word or `workbook_type` for Excel.
- Preserve factual values exactly.
- Do not invent legal bases, recipients, or signer data.

## Word spec minimum

```json
{
  "document_type": "cong-van",
  "parent_agency": "...",
  "issuing_agency": "...",
  "document_number": "12",
  "document_symbol": "SGDDT-VP",
  "location": "Hà Giang",
  "issue_date": "2026-04-15",
  "subject": "V/v ...",
  "kinh_gui": ["..."],
  "body_paragraphs": ["..."],
  "signer_position": "GIÁM ĐỐC",
  "signer_name": "...",
  "noi_nhan": ["Như trên;", "Lưu: VT, ..."]
}
```

## Workbook spec minimum

```json
{
  "workbook_type": "so-dang-ky-van-ban-di",
  "title": "SỔ ĐĂNG KÝ VĂN BẢN ĐI",
  "sheet_name": "Dang-ky",
  "rows": []
}
```

## Optional control fields

### `generation_mode`
Use one of:
- `canonical`
- `replicate`
- `auto`

If omitted, the script decides.

### `template_hint`
Short hint such as `cong-van-template.docx` used to pick a built-in mẫu or profile.

### `notes_for_generator`
Human notes for the agent. Do not assume these become visible in the output.

## Type-specific additions

### Decisions and resolutions
Prefer `articles` over only raw paragraphs.

### Meeting minutes
Include meeting metadata such as:
- `meeting_start`
- `meeting_end`
- `meeting_location`
- `meeting_attendees`
- `meeting_chair`
- `meeting_secretary`

### Appendix and copy documents
Use explicit fields such as:
- `appendix_number`
- `appendix_title`
- `appendix_parent_note`
- `copy_form`
- `copy_agency`

## Recommended usage

1. Build the content spec first.
2. Validate it.
3. Choose canonical or replicate mode.
4. Generate the document or workbook.
5. Audit and render if needed.
