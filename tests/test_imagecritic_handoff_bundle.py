import json
import zipfile

import pytest
from PIL import Image

from scripts.imagecritic_handoff_bundle import build_bundle, contained_file, sha256


def test_containment_rejects_escape(tmp_path):
    with pytest.raises(ValueError):
        contained_file(tmp_path, "../not-in-dataset.png")


def test_private_bundle_is_minimal_and_does_not_authorize_generation(tmp_path):
    source = tmp_path / "data"
    (source / "prepared").mkdir(parents=True)
    Image.new("RGB", (60, 80), "gray").save(source / "sample.png")
    digest = sha256(source / "sample.png")
    image = {"path": "sample.png", "sha256": digest, "size": [60, 80]}
    (source / "manifest.json").write_text(
        json.dumps(
            {
                "cases": [
                    {
                        "try_on_number": 51,
                        "files": {role: image for role in ("car", "rim", "result")},
                    }
                ],
            }
        )
    )
    Image.new("RGB", (20, 30), "gray").save(source / "prepared/crop.png")
    (source / "prepared/manifest.json").write_text(
        json.dumps(
            {
                "assets": [
                    {
                        "case": 51,
                        "role": role,
                        "image": "crop.png",
                        "sha256": sha256(source / "prepared/crop.png"),
                        "size": [20, 30],
                        "face_bbox_xyxy": [1, 2, 19, 28],
                    }
                    for role in ("rim", "front")
                ],
            }
        )
    )
    archive = build_bundle(source, tmp_path / "out")
    with zipfile.ZipFile(archive) as handle:
        assert len(handle.namelist()) == 8
        case = json.loads(handle.read("imagecritic-case51-v1/case.json"))
        assert case["generation_authorized_for_this_case"] is False
        assert case["approved_defect"] is None
        inventory = json.loads(handle.read("imagecritic-case51-v1/bundle-inventory.json"))
        assert len(inventory["files"]) == 7
    with pytest.raises(ValueError):
        build_bundle(source, tmp_path / "out")
