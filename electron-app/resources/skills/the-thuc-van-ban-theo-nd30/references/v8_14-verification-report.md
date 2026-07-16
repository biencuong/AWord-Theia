# V8.14 verification report

## Verified files present
- SKILL.md with updated slug name
- agents/openai.yaml with display name "Thể thức văn bản theo NĐ30"
- scripts/review_nd30_language.py
- scripts/apply_nd30_rewrites.py
- scripts/preview_nd30_layout.py
- scripts/choose_nd30_strategy.py
- references/nd30-llm-review-prompt.md
- references/nd30-llm-review-checklist.md
- references/nd30-render-and-scan-guidance.md
- references/nd30-standard-two-zone-template.md
- assets/templates/standards/mau-tieu-ngu-va-noi-nhan-chuan.docx
- assets/profiles/standards/mau-tieu-ngu-va-noi-nhan-chuan.profile.json

## Smoke tests run
- create_nd30_docx.py -> PASS
- check_nd30_docx.py -> executed
- review_nd30_language.py -> PASS
- apply_nd30_rewrites.py -> PASS
- choose_nd30_strategy.py -> PASS

## Notes
- DOCX preview rendering requires LibreOffice/soffice and Poppler/pdftoppm.
- Tesseract OCR is not required.
