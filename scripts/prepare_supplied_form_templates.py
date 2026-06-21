from __future__ import annotations

import sys
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from lxml import etree


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}

REPLACEMENTS = {
    "information": {
        "Burmese": "{{respondent_ethnicity_other_value}}",
        "24 May 2026": "{{relationship_end_date}}",
    },
    "parenting": {
        "at Auckland": "at {{English_court_name}}",
        "Family Court at                            for": "Family Court at {{English_court_name}} for",
    },
    "protection": {
        "North Shore": "{{English_court_name}}",
    },
}


def patch_document_xml(data: bytes, form_kind: str) -> bytes:
    parser = etree.XMLParser(remove_blank_text=False)
    root = etree.fromstring(data, parser)
    replacements = REPLACEMENTS[form_kind]
    found = {source: 0 for source in replacements}

    for text_node in root.xpath(".//w:t", namespaces=NS):
        value = text_node.text or ""
        for source, destination in replacements.items():
            if source in value:
                value = value.replace(source, destination)
                found[source] += 1
        text_node.text = value

    if form_kind == "information":
        ethnicity_paragraphs = [
            paragraph
            for paragraph in root.xpath(".//w:p", namespaces=NS)
            if "Please state:" in "".join(paragraph.xpath(".//w:t/text()", namespaces=NS))
        ]
        if not ethnicity_paragraphs:
            raise RuntimeError("Expected ethnicity paragraphs not found in information template")
        applicant_paragraph = ethnicity_paragraphs[0]
        applicant_text = "".join(applicant_paragraph.xpath(".//w:t/text()", namespaces=NS))
        if "{{applicant_ethnicity_other_value}}" not in applicant_text:
            text_nodes = applicant_paragraph.xpath(".//w:t", namespaces=NS)
            text_nodes[-1].text = (text_nodes[-1].text or "") + " {{applicant_ethnicity_other_value}}"

    document_text = "".join(root.xpath(".//w:t/text()", namespaces=NS))
    missing = [
        source
        for source, count in found.items()
        if count == 0 and replacements[source] not in document_text
    ]
    if missing:
        raise RuntimeError(f"Expected text not found in {form_kind} template: {', '.join(missing)}")

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone="yes")


def patch_template(path: Path, form_kind: str) -> None:
    with ZipFile(path, "r") as archive:
        entries: list[tuple[ZipInfo, bytes]] = []
        for info in archive.infolist():
            data = archive.read(info.filename)
            if info.filename == "word/document.xml":
                data = patch_document_xml(data, form_kind)
            entries.append((info, data))

    with NamedTemporaryFile(suffix=".docx", delete=False, dir=path.parent) as temp:
        temp_path = Path(temp.name)
    try:
        with ZipFile(temp_path, "w", ZIP_DEFLATED) as archive:
            for info, data in entries:
                archive.writestr(info, data)
        temp_path.replace(path)
    finally:
        temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[2] not in REPLACEMENTS:
        kinds = "|".join(REPLACEMENTS)
        raise SystemExit(f"usage: prepare_supplied_form_templates.py TEMPLATE.docx {kinds}")
    patch_template(Path(sys.argv[1]).resolve(), sys.argv[2])
