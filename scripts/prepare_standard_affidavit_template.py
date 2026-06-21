from __future__ import annotations

import shutil
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from lxml import etree


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}


def paragraph_text(paragraph: etree._Element) -> str:
    return "".join(paragraph.xpath(".//w:t/text()", namespaces=NS)).strip()


def replace_paragraph_text(paragraph: etree._Element, value: str) -> None:
    text_nodes = paragraph.xpath(".//w:t", namespaces=NS)
    if not text_nodes:
        run = etree.SubElement(paragraph, f"{{{W_NS}}}r")
        text_node = etree.SubElement(run, f"{{{W_NS}}}t")
        text_node.text = value
        return

    text_nodes[0].text = value
    for text_node in text_nodes[1:]:
        text_node.text = ""


def find_paragraph(body: etree._Element, predicate, label: str) -> etree._Element:
    matches = [
        paragraph
        for paragraph in body.findall(f"{{{W_NS}}}p")
        if predicate(paragraph_text(paragraph))
    ]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one {label} paragraph, found {len(matches)}")
    return matches[0]


def patch_document_xml(data: bytes) -> bytes:
    parser = etree.XMLParser(remove_blank_text=False)
    root = etree.fromstring(data, parser)
    body = root.find(f"{{{W_NS}}}body")
    if body is None:
        raise RuntimeError("Template has no document body")

    title = find_paragraph(body, lambda text: text.startswith("AFFIDAVIT OF "), "title")
    replace_paragraph_text(
        title,
        "AFFIDAVIT OF {{APPLICANT_NAME}} IN SUPPORT OF {{affidavit_application_title}}",
    )

    affirmation = find_paragraph(body, lambda text: text.startswith("I, {{APPLICANT_NAME}}"), "affirmation")
    replace_paragraph_text(
        affirmation,
        "I, {{APPLICANT_NAME}} of {{applicant_home_address}} affirm,",
    )

    protection_heading = find_paragraph(
        body,
        lambda text: text == "FACTS IN SUPPORT OF APPLICATION FOR PROTECTION ORDER",
        "protection facts heading",
    )
    replace_paragraph_text(protection_heading, "{{protection_facts_heading}}")

    parenting_heading = find_paragraph(
        body,
        lambda text: text == "{{parenting_heading}}",
        "parenting heading",
    )
    parenting_blurb = find_paragraph(
        body,
        lambda text: text == "{{parenting_blurb}}",
        "parenting blurb",
    )

    without_notice_heading = find_paragraph(
        body,
        lambda text: text.lower() == "facts in support of application for protection order without notice",
        "without-notice heading",
    )
    replace_paragraph_text(without_notice_heading, "{{without_notice_heading}}")

    without_notice_intro = find_paragraph(
        body,
        lambda text: text.startswith("The Application for a Protection Order is being made without notice"),
        "without-notice introduction",
    )
    replace_paragraph_text(without_notice_intro, "{{without_notice_intro}}")

    safety_one = find_paragraph(
        body,
        lambda text: text.startswith("I am very fearful for my safety"),
        "first safety factor",
    )
    replace_paragraph_text(safety_one, "{{without_notice_safety}}")
    safety_two = find_paragraph(
        body,
        lambda text: text.startswith("I believe that if the Respondent knew"),
        "second safety factor",
    )
    body.remove(safety_two)

    orders_heading = find_paragraph(body, lambda text: text == "ORDERS SOUGHT", "orders heading")
    body.remove(parenting_heading)
    body.remove(parenting_blurb)
    orders_index = body.index(orders_heading)
    body.insert(orders_index, parenting_heading)
    body.insert(orders_index + 1, parenting_blurb)

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone="yes")


def patch_template(source: Path, destination: Path) -> None:
    shutil.copy2(source, destination)
    with ZipFile(destination, "r") as archive:
        entries: list[tuple[ZipInfo, bytes]] = []
        for info in archive.infolist():
            data = archive.read(info.filename)
            if info.filename == "word/document.xml":
                data = patch_document_xml(data)
            entries.append((info, data))

    with NamedTemporaryFile(suffix=".docx", delete=False, dir=destination.parent) as temp:
        temp_path = Path(temp.name)
    try:
        with ZipFile(temp_path, "w", ZIP_DEFLATED) as archive:
            for info, data in entries:
                archive.writestr(info, data)
        temp_path.replace(destination)
    finally:
        temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: prepare_standard_affidavit_template.py SOURCE.docx DESTINATION.docx")
    patch_template(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
