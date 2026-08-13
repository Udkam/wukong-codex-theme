from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UI_ROOT = ROOT / "themes" / "ui" / "v15"
CSS_PATH = ROOT / "runtime" / "wukong-codex-theme-background-v13.css"
ACTIVE_THEME_PATH = ROOT / "themes" / "active.json"

PAPER_ASSETS = {
    "composer_main": {
        "filename": "composer-main.webp",
        "size": (1536, 378),
        "median": (131, 111, 86),
        "std": ((9, 14), (9, 14), (9, 14)),
    },
    "composer_strip": {
        "filename": "composer-strip.webp",
        "size": (1536, 136),
        "median": (132, 115, 91),
        "std": ((9, 15), (9, 15), (9, 15)),
    },
    "composer_pill": {
        "filename": "composer-pill.webp",
        "size": (768, 110),
        "median": (133, 115, 90),
        "std": ((7, 13), (7, 13), (7, 13)),
    },
    "paper_tile": {
        "filename": "paper-tile.webp",
        "size": (768, 330),
        "median": (134, 117, 93),
        "std": ((2, 5), (2, 5), (2, 5)),
    },
}

PAPER_ALPHA_BOXES = {
    "composer_main": (58, 52, 1478, 326),
    "composer_strip": (52, 44, 1484, 92),
    "composer_pill": (44, 36, 724, 74),
}


def opaque_rgb(path: Path) -> np.ndarray:
    pixels = np.asarray(Image.open(path).convert("RGBA"))
    return pixels[..., :3][pixels[..., 3] >= 240]


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    normalized = rgb.astype(np.float64) / 255
    linear = np.where(
        normalized <= 0.04045,
        normalized / 12.92,
        ((normalized + 0.055) / 1.055) ** 2.4,
    )
    return linear @ np.array([0.2126, 0.7152, 0.0722])


def contrast_ratio(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    lighter = np.maximum(left, right)
    darker = np.minimum(left, right)
    return (lighter + 0.05) / (darker + 0.05)


class V15DarkPaperMaterialTest(unittest.TestCase):
    def test_active_composer_uses_continuous_scroll_materials(self) -> None:
        active = json.loads(ACTIVE_THEME_PATH.read_text(encoding="utf-8"))
        expected = {
            "composerMain": "ui/v17/composer-main.webp",
            "composerStrip": "ui/v17/composer-strip.webp",
            "composerPill": "ui/v17/composer-pill.webp",
            "paperTile": "ui/v17/paper-tile.webp",
        }
        self.assertEqual(
            {key: active["uiAssets"][key] for key in expected},
            expected,
        )

        for key in ("composerMain", "composerStrip", "composerPill"):
            path = ROOT / "themes" / active["uiAssets"][key]
            rgba = np.asarray(Image.open(path).convert("RGBA"))
            height, width = rgba.shape[:2]
            centre = rgba[
                height // 3:height - height // 3,
                width // 3:width - width // 3,
                3,
            ]
            self.assertGreaterEqual(int(np.min(centre)), 240, key)
            self.assertEqual(int(rgba[0, 0, 3]), 0, key)
            self.assertEqual(int(rgba[-1, -1, 3]), 0, key)

        css = CSS_PATH.read_text(encoding="utf-8")
        strip_contract = re.search(
            r"\.forge-composer-context,\s*"
            r":root\.forge-ink-mountain \.forge-composer-panel-stack\s*\{"
            r".*?background-color:\s*transparent\s*!important;"
            r".*?border-radius:\s*0\s*!important;"
            r".*?clip-path:\s*polygon\(",
            css,
            re.S,
        )
        self.assertIsNotNone(strip_contract)
        pill_contract = re.search(
            r"\.forge-composer-progress-pill,\s*"
            r":root\.forge-ink-mountain \.forge-plan-pill,\s*"
            r":root\.forge-ink-mountain \.forge-diff-summary\s*\{"
            r".*?background-color:\s*transparent\s*!important;"
            r".*?border-radius:\s*999px\s*!important;",
            css,
            re.S,
        )
        self.assertIsNotNone(pill_contract)

    def test_landing_mark_is_a_small_transparent_real_model_asset(self) -> None:
        path = UI_ROOT / "landing-jingubang.webp"
        with Image.open(path) as image:
            self.assertEqual(image.size, (112, 112))
            rgba = np.asarray(image.convert("RGBA"))
        visible = rgba[..., 3] > 16
        visible_y, visible_x = np.where(visible)
        visible_bbox = (
            int(visible_x.min()),
            int(visible_y.min()),
            int(visible_x.max()) + 1,
            int(visible_y.max()) + 1,
        )
        visible_width = visible_bbox[2] - visible_bbox[0]
        visible_height = visible_bbox[3] - visible_bbox[1]
        self.assertGreaterEqual(visible_width, 96)
        self.assertLessEqual(visible_width, 106)
        self.assertGreaterEqual(visible_height, 80)
        self.assertLessEqual(visible_height, 92)
        self.assertEqual(int(np.count_nonzero(visible[0, :])), 0)
        self.assertEqual(int(np.count_nonzero(visible[-1, :])), 0)
        self.assertEqual(int(np.count_nonzero(visible[:, 0])), 0)
        self.assertEqual(int(np.count_nonzero(visible[:, -1])), 0)
        left_margin = visible_bbox[0]
        right_margin = 112 - visible_bbox[2]
        top_margin = visible_bbox[1]
        bottom_margin = 112 - visible_bbox[3]
        self.assertLessEqual(abs(left_margin - right_margin), 2)
        self.assertLessEqual(abs(top_margin - bottom_margin), 2)
        self.assertLessEqual(visible_bbox[2], 110)
        self.assertLessEqual(visible_bbox[3], 110)
        self.assertGreater(int(np.count_nonzero(visible)), 1_200)
        self.assertLess(int(np.count_nonzero(visible)), 4_500)
        visible_ratio = float(np.mean(visible))
        self.assertGreaterEqual(visible_ratio, 0.09)
        self.assertLessEqual(
            visible_ratio,
            0.22,
            "the sub-pixel umber edge must not turn the real staff into a heavy icon",
        )
        centered = np.column_stack(
            (
                visible_x - np.mean(visible_x),
                visible_y - np.mean(visible_y),
            )
        )
        covariance = np.cov(centered, rowvar=False)
        eigenvalues, eigenvectors = np.linalg.eigh(covariance)
        principal = eigenvectors[:, int(np.argmax(eigenvalues))]
        principal_angle = float(
            np.degrees(np.arctan2(principal[1], principal[0])) % 180
        )
        self.assertGreaterEqual(principal_angle, 138)
        self.assertLessEqual(principal_angle, 144)
        self.assertLess(path.stat().st_size, 8_192)

        visible_rgb = rgba[..., :3][rgba[..., 3] > 32]
        visible_luminance = relative_luminance(visible_rgb)
        dark_material = float(np.percentile(visible_luminance, 20))
        bright_material = float(np.percentile(visible_luminance, 85))
        self.assertLessEqual(
            dark_material,
            0.06,
            "the real dark-red shaft must remain legible on bright scenes",
        )
        self.assertGreaterEqual(
            bright_material,
            0.20,
            "aged-gold rings must remain legible on dark scenes",
        )
        self.assertGreaterEqual(
            float(
                contrast_ratio(
                    np.array([relative_luminance(np.array([[190, 190, 190]]))[0]]),
                    np.array([dark_material]),
                )[0]
            ),
            3.0,
        )
        self.assertGreaterEqual(
            float(
                contrast_ratio(
                    np.array([bright_material]),
                    np.array([relative_luminance(np.array([[28, 30, 29]]))[0]]),
                )[0]
            ),
            3.0,
        )

        metrics = json.loads(
            (UI_ROOT / "asset-metrics.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            metrics["source_files"]["landing_mark"],
            "themes/ui/v15/sources/jingubang-model.png",
        )
        self.assertEqual(
            metrics["outputs"]["landing_mark"]["size"],
            [112, 112],
        )

    def test_generated_paper_assets_share_the_reviewed_native_paper_family(self) -> None:
        metrics = json.loads(
            (UI_ROOT / "asset-metrics.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            metrics["contract"],
            "v16-native-geometry-paper-family",
        )
        self.assertEqual(metrics["paper_palette"]["target_median_rgb"], [135, 117, 93])
        self.assertEqual(metrics["paper_palette"]["matte_rgb"], [135, 117, 93])
        self.assertEqual(metrics["paper_palette"]["texture_contrast"], 0.74)
        self.assertEqual(metrics["paper_palette"]["tile_crop"], [540, 185, 1052, 405])
        self.assertNotIn("channel_offset", metrics["paper_palette"])

        for key, contract in PAPER_ASSETS.items():
            path = UI_ROOT / contract["filename"]
            with Image.open(path) as image:
                self.assertEqual(image.size, contract["size"], key)
            rgb = opaque_rgb(path)
            median = np.median(rgb, axis=0)
            std = np.std(rgb, axis=0)
            for channel, expected in enumerate(contract["median"]):
                self.assertLessEqual(
                    abs(float(median[channel]) - expected),
                    4,
                    f"{key} channel {channel} median drifted",
                )
            for channel, (minimum, maximum) in enumerate(contract["std"]):
                self.assertGreaterEqual(float(std[channel]), minimum, key)
                self.assertLessEqual(float(std[channel]), maximum, key)
            self.assertEqual(
                metrics["outputs"][key]["size"],
                list(contract["size"]),
            )

    def test_border_contracts_have_clear_centres_and_the_tile_is_periodic(self) -> None:
        metrics = json.loads(
            (UI_ROOT / "asset-metrics.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            metrics["paper_palette"]["center_alpha_boxes"],
            {key: list(box) for key, box in PAPER_ALPHA_BOXES.items()},
        )
        for key, box in PAPER_ALPHA_BOXES.items():
            rgba = np.asarray(
                Image.open(UI_ROOT / PAPER_ASSETS[key]["filename"]).convert("RGBA")
            )
            left, top, right, bottom = box
            self.assertEqual(
                int(np.max(rgba[top:bottom, left:right, 3])),
                0,
                key,
            )
            self.assertGreater(
                float(np.mean(rgba[..., 3] >= 240)),
                0.25,
                key,
            )
            alpha_contract = metrics["outputs"][key]["alpha"]
            self.assertEqual(alpha_contract["min"], 0, key)
            self.assertEqual(alpha_contract["max"], 255, key)
            self.assertEqual(
                alpha_contract["transparent_pixels"],
                int(np.count_nonzero(rgba[..., 3] == 0)),
                key,
            )

        tile = np.asarray(
            Image.open(UI_ROOT / PAPER_ASSETS["paper_tile"]["filename"]).convert("RGBA")
        )
        self.assertEqual(int(np.min(tile[..., 3])), 255)
        self.assertEqual(metrics["outputs"]["paper_tile"]["alpha"]["min"], 255)
        self.assertEqual(metrics["outputs"]["paper_tile"]["alpha"]["max"], 255)
        self.assertEqual(
            metrics["outputs"]["paper_tile"]["alpha"]["transparent_pixels"],
            0,
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

        total_bytes = sum(
            (UI_ROOT / PAPER_ASSETS[key]["filename"]).stat().st_size
            for key in PAPER_ASSETS
        )
        self.assertLessEqual(
            total_bytes,
            130_000,
            "all four composer paper assets must stay under the low-cost budget",
        )

    def test_css_uses_reviewed_fallback_without_gpu_filter_or_filled_border_image(self) -> None:
        css = CSS_PATH.read_text(encoding="utf-8")
        self.assertGreaterEqual(
            css.count("#87755d"),
            1,
            "the main scroll keeps one low-cost failure fallback",
        )
        self.assertGreaterEqual(
            css.count("background-color: transparent !important;"),
            2,
            "strip and pill surfaces must not refill their transparent corners",
        )
        self.assertNotIn("#d1b78f", css)
        self.assertNotIn("#cfb48a", css)
        self.assertNotIn("filter: contrast(1.16) saturate(.94)", css)
        self.assertNotRegex(
            css,
            r"border-image-slice\s*:[^;]*\bfill\b",
        )
        layered_paper_sizes = re.findall(
            r"background-size:\s*100%\s+100%,\s*512px\s+220px\s*!important",
            css,
        )
        self.assertGreaterEqual(
            len(layered_paper_sizes),
            2,
            "main scroll and progress pill must retain the reviewed tile layer",
        )
        self.assertRegex(
            css,
            r"background-size:\s*100%\s+200%,\s*512px\s+220px\s*!important",
            "the joined queue/goal strip must paint only the source's upper corners",
        )

    def test_primary_ink_keeps_three_to_one_contrast_on_dark_paper(self) -> None:
        css = CSS_PATH.read_text(encoding="utf-8")
        primary_match = re.search(
            r"\.forge-composer-frame\s*\{.*?"
            r"--color-token-foreground:\s*(#[0-9a-fA-F]{6})",
            css,
            re.S,
        )
        self.assertIsNotNone(primary_match)
        primary = np.array(
            [
                int(primary_match.group(1)[index:index + 2], 16)
                for index in (1, 3, 5)
            ]
        )
        ink_luminance = float(relative_luminance(primary.reshape(1, 3))[0])

        for key, contract in PAPER_ASSETS.items():
            rgb = opaque_rgb(UI_ROOT / contract["filename"])
            paper_luminance = relative_luminance(rgb)
            representative_dark = float(np.percentile(paper_luminance, 10))
            ratio = float(
                contrast_ratio(
                    np.array([representative_dark]),
                    np.array([ink_luminance]),
                )[0]
            )
            self.assertGreaterEqual(ratio, 3.0, key)

        tile_rgb = opaque_rgb(UI_ROOT / PAPER_ASSETS["paper_tile"]["filename"])
        tile_luminance = relative_luminance(tile_rgb)
        tile_ratio = contrast_ratio(
            tile_luminance,
            np.full(tile_luminance.shape, ink_luminance),
        )
        self.assertGreaterEqual(float(np.percentile(tile_ratio, 10)), 4.0)
        self.assertGreaterEqual(float(np.median(tile_ratio)), 4.5)


if __name__ == "__main__":
    unittest.main()
