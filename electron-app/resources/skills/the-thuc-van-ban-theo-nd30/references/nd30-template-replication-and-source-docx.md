
# ND30 template replication and source DOCX workflow

Use this reference when the user gives you a sample Word file and says things like:

- dùng mẫu này để làm văn bản mới
- bắt chước đúng thể thức mẫu
- đối chiếu file này với mẫu
- lấy mẫu trong thư mục mẫu rồi soạn theo mẫu đó

## Preferred order

1. **User sample DOCX** if the user provides one and wants continuity with that exact shell.
2. **Internal template DOCX** in `assets/templates/` if the user wants a standard ND30 sample form.
3. **Generic ND30 generator** if there is no usable source template.

## Three practical modes

### Mode A: Audit a user file

1. Run `scripts/check_nd30_docx.py` against the user DOCX.
2. If a matching internal template exists, also compare with `--template`.
3. Report:
   - detected document type
   - ND30 issues
   - differences from the chosen template

### Mode B: Extract a reusable template profile

Use this when the user has a sample file and wants to reuse its formatting repeatedly.

```bash
python scripts/extract_docx_template.py source.docx template-profile.json
```

This does not create a new DOCX. It creates a profile for inspection and comparison.

### Mode C: Compose a new document from an existing DOCX shell

Use this when the user wants a new document that follows a given sample/template more closely than the generic ND30 generator.

```bash
python scripts/compose_from_source_docx.py source-template.docx spec.json output.docx
```

This keeps the source document container, section shell, and reusable formatting context, then composes a new ND30 document body into it.

## Placeholder templates vs reference-only templates

- If the DOCX contains placeholders like `{{issuing_agency}}`, prefer `scripts/fill_docx_template.py`.
- If the DOCX is only a visual reference without placeholders, prefer `scripts/compose_from_source_docx.py`.

## Internal templates

Look in `assets/templates/` for ready-to-use ND30 sample shells and placeholder templates.

Use them when:
- the user asks for a standard sample form,
- the user has no file of their own,
- or you want a starting point before customizing.


## v5 profile-first rule

When a user wants to follow a mẫu, do not jump straight to editing. First extract a reusable format profile, then decide whether to generate in replicate mode or switch back to canonical mode if the source mẫu is weak or conflicts with ND30.
