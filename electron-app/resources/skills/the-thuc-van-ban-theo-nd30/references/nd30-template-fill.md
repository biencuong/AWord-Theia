# ND30 template fill rules

Use this file when the task is to fill a Word template from structured data or Excel rows.

## Placeholder convention

Use double curly braces in template text:
- `{{document_number}}`
- `{{issue_date}}`
- `{{signer_name}}`
- `{{recipient_name}}`

Keep placeholders simple, lowercase, and snake_case.

## Practical rules

1. Prefer placeholders that map directly to one JSON key or one Excel column.
2. Fill one sample document first before running all rows.
3. Preserve fixed ND30 wording in the template; vary only the data fields.
4. For recipient-heavy documents, keep `{{kinh_gui}}` or `{{noi_nhan}}` as placeholders only if the data source already stores the final formatted value. Otherwise prepare that block before filling.
5. Do not rely on template filling alone to guarantee ND30 compliance. Check the resulting file against the ND30 validation checklist.

## Excel row strategy

When reading from Excel:
- Treat the header row as field names.
- Convert empty cells to empty strings.
- Use `--row` for controlled testing.
- Use `--all-rows` only after the sample output is accepted.

## File naming for batch runs

Prefer one of these patterns:
- document type + row number
- document number if unique
- recipient or subject slug if safe and short

Avoid filenames with forbidden path characters.
