from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UI_ROOT = ROOT / "themes" / "ui" / "v17"
CSS_PATH = ROOT / "runtime" / "wukong-codex-theme-background-v13.css"
ACTIVE_THEME_PATH = ROOT / "themes" / "active.json"

PAPER_ASSETS = {
    "composer_main": {
        "theme_key": "composerMain",
        "filename": "composer-main.webp",
        "size": (1024, 252),
        "std": ((6, 11), (6, 11), (6, 11)),
    },
    "composer_strip": {
        "theme_key": "composerStrip",
        "filename": "composer-strip.webp",
        "size": (1024, 90),
        "std": ((8, 14), (8, 14), (8, 14)),
    },
    "composer_pill": {
        "theme_key": "composerPill",
        "filename": "composer-pill.webp",
        "size": (512, 74),
        "std": ((7, 12), (7, 12), (7, 12)),
    },
    "paper_tile": {
        "theme_key": "paperTile",
        "filename": "paper-tile.webp",
        "size": (384, 192),
        "std": ((2, 6), (2, 6), (2, 6)),
    },
}


class V17FullFieldDarkPaperTest(unittest.TestCase):
    def test_active_theme_uses_the_full_field_dark_paper_family(self) -> None:
        active = json.loads(ACTIVE_THEME_PATH.read_text(encoding="utf-8"))
        for contract in PAPER_ASSETS.values():
            self.assertEqual(
                active["uiAssets"][contract["theme_key"]],
                f"ui/v17/{contract['filename']}",
            )

        metrics = json.loads(
            (UI_ROOT / "asset-metrics.json").read_text(encoding="utf-8")
        )
        self.assertEqual(metrics["contract"], "v21-full-field-dark-paper")
        self.assertEqual(metrics["paper_palette"]["target_median_rgb"], [135, 117, 93])
        self.assertEqual(metrics["paper_palette"]["matte_rgb"], [135, 117, 93])
        self.assertEqual(metrics["paper_palette"]["texture_contrast"], 0.86)
        self.assertEqual(metrics["paper_palette"]["centre_contract"], "opaque")

    def test_surfaces_keep_full_opaque_centres_and_transparent_outer_corners(self) -> None:
        for key, contract in PAPER_ASSETS.items():
            path = UI_ROOT / contract["filename"]
            with Image.open(path) as image:
                self.assertEqual(image.size, contract["size"], key)
                rgba = np.asarray(image.convert("RGBA"))
            rgb = rgba[..., :3][rgba[..., 3] >= 240]
            median = np.median(rgb, axis=0)
            std = np.std(rgb, axis=0)
            for channel, target in enumerate((135, 117, 93)):
                self.assertLessEqual(
                    abs(float(median[channel]) - target),
                    2,
                    f"{key} channel {channel} median drifted",
                )
            for channel, (minimum, maximum) in enumerate(contract["std"]):
                self.assertGreaterEqual(float(std[channel]), minimum, key)
                self.assertLessEqual(float(std[channel]), maximum, key)

            if key == "paper_tile":
                self.assertEqual(int(np.min(rgba[..., 3])), 255)
                continue

            height, width = rgba.shape[:2]
            centre = rgba[
                height // 3:height - height // 3,
                width // 3:width - width // 3,
                3,
            ]
            self.assertGreaterEqual(int(np.min(centre)), 240, key)
            self.assertEqual(int(rgba[0, 0, 3]), 0, key)
            self.assertEqual(int(rgba[-1, -1, 3]), 0, key)

        total_bytes = sum(
            (UI_ROOT / contract["filename"]).stat().st_size
            for contract in PAPER_ASSETS.values()
        )
        self.assertLessEqual(total_bytes, 130_000)

    def test_tile_is_periodic_without_a_visible_repeat_seam(self) -> None:
        tile = np.asarray(
            Image.open(UI_ROOT / PAPER_ASSETS["paper_tile"]["filename"]).convert("RGBA")
        )
        left_right = np.abs(
            tile[:, 0, :3].astype(np.int16) - tile[:, -1, :3].astype(np.int16)
        )
        top_bottom = np.abs(
            tile[0, :, :3].astype(np.int16) - tile[-1, :, :3].astype(np.int16)
        )
        self.assertLessEqual(float(np.mean(left_right)), 1.1)
        self.assertLessEqual(float(np.mean(top_bottom)), 1.1)
        self.assertLessEqual(int(np.max(left_right)), 8)
        self.assertLessEqual(int(np.max(top_bottom)), 8)

    def test_css_preserves_native_composer_geometry_with_paint_only_corners(self) -> None:
        css = CSS_PATH.read_text(encoding="utf-8")
        main_rule = re.search(
            r":root\.forge-ink-mountain\s+:is\(\s*"
            r"\.forge-composer-frame,.*?"
            r"\)\s*\{(?P<body>.*?)\n\}",
            css,
            re.S,
        )
        self.assertIsNotNone(main_rule)
        main_body = main_rule.group("body")
        self.assertNotRegex(
            main_body,
            r"(?:aspect-ratio|min-height|max-height|padding(?:-\w+)?):",
        )
        self.assertRegex(main_body, r"clip-path:\s*none\s*!important")

        paper_rule = re.search(
            r":root\.forge-ink-mountain\s+:is\(\s*"
            r"\.forge-composer-frame,.*?"
            r"\)::before\s*\{(?P<body>.*?)\n\}",
            css,
            re.S,
        )
        self.assertIsNotNone(paper_rule)
        paper_body = paper_rule.group("body")
        self.assertRegex(paper_body, r"inset:\s*0")
        self.assertRegex(paper_body, r"pointer-events:\s*none")
        self.assertRegex(paper_body, r"background-size:\s*100%\s+100%")
        self.assertRegex(paper_body, r"clip-path:\s*polygon\(")
        self.assertIn("calc(100% - 8px)", paper_body)

        outer_field_rule = re.search(
            r"\.forge-composer-context::before,\s*"
            r":root\.forge-ink-mountain \.forge-composer-panel::before\s*\{"
            r"(?P<body>.*?)\n\}",
            css,
            re.S,
        )
        self.assertIsNotNone(outer_field_rule)
        outer_field_body = outer_field_rule.group("body")
        self.assertIn("100% 100%, 512px 220px", outer_field_body)
        self.assertRegex(outer_field_body, r"clip-path:\s*none")
        self.assertNotIn("var(--forge-ui-composer-strip)", outer_field_body)
        self.assertRegex(
            css,
            r"(?s)\.forge-composer-panel-stack\s*"
            r">\s*\.forge-composer-panel:first-child::before\s*\{.*?"
            r"clip-path:\s*polygon\(",
        )
        self.assertRegex(
            css,
            r"(?s)\.forge-composer-panel-stack\s*"
            r">\s*\.forge-composer-panel:first-child::after\s*\{.*?"
            r"background-image:\s*var\(--forge-ui-composer-strip\);.*?"
            r"background-size:\s*100%\s+58px\s*!important;",
        )
        self.assertRegex(
            css,
            r"(?s)\.forge-composer-panel\s*\{.*?"
            r"position:\s*relative\s*!important;.*?"
            r"isolation:\s*isolate;",
        )
        self.assertRegex(
            css,
            r"(?s)\.forge-composer-panel-stack::before\s*\{"
            r".*?content:\s*none\s*!important;",
        )
        self.assertRegex(
            css,
            r"(?s)\.forge-composer-queue-item::before\s*\{.*?"
            r"background-image:\s*var\(--forge-ui-paper-tile\);.*?"
            r"background-size:\s*512px\s+220px\s*!important;.*?"
            r"clip-path:\s*none;.*?"
            r"box-shadow:\s*none;",
        )

        self.assertRegex(
            css,
            r"(?s)\.forge-composer-progress-pill,.*?"
            r"\.forge-diff-summary\s*\{.*?"
            r"border-radius:\s*999px\s*!important;",
        )


if __name__ == "__main__":
    unittest.main()
