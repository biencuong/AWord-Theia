# Render and scan guidance

## DOCX preview render
Use LibreOffice/`soffice` plus Poppler/`pdftoppm` to render DOCX pages to PNG and visually inspect the final layout.

If `soffice` is missing, install **LibreOffice** and ensure `soffice` is in `PATH`.

If `pdftoppm` is missing, install **Poppler**.

## OCR policy
Do **not** require Tesseract OCR for this skill.
When the user provides a scan-only document, read the scan content using the best available vision/OCR path in the environment, then rebuild a clean DOCX with the ND30 + DOCX workflow.
