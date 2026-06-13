from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from psd_tools import PSDImage


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "assets" / "image"
OUT_DIR = IMAGE_DIR / "live2d-draft"

BACKGROUND_PATH = IMAGE_DIR / "1-background-only.png"
CHARACTER_PATH = IMAGE_DIR / "1-character-transparent.png"
ORIGINAL_PATH = IMAGE_DIR / "1.png"
CHROMAKEY_PATH = IMAGE_DIR / "1-character-chromakey.png"

OUT_PSD = IMAGE_DIR / "1-live2d-draft.psd"
OUT_PREVIEW = IMAGE_DIR / "1-live2d-draft-preview.png"


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def feathered_rect_mask(size: tuple[int, int], radius: int = 8) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(max(1, radius // 2)))


def paste_feathered(dst: Image.Image, src: Image.Image, box: tuple[int, int, int, int], radius: int = 8) -> None:
    crop = src.crop(box)
    mask = feathered_rect_mask(crop.size, radius)
    alpha = crop.getchannel("A")
    mask = Image.composite(mask, Image.new("L", crop.size, 0), alpha)
    dst.alpha_composite(Image.composite(crop, Image.new("RGBA", crop.size, (0, 0, 0, 0)), mask), box[:2])


def sample_skin_color(character: Image.Image) -> tuple[int, int, int, int]:
    arr = np.array(character)
    rgb = arr[..., :3]
    alpha = arr[..., 3]
    # Face/cheek region of the generated sprite. This intentionally stays
    # conservative so hair and white jacket pixels do not skew the sample.
    region = rgb[150:260, 390:530]
    region_alpha = alpha[150:260, 390:530]
    skin_mask = (
        (region_alpha > 200)
        & (region[..., 0] > 175)
        & (region[..., 1] > 115)
        & (region[..., 2] > 105)
        & (region[..., 0] > region[..., 1])
        & (region[..., 1] >= region[..., 2] - 8)
    )
    pixels = region[skin_mask]
    if len(pixels) == 0:
        return (240, 203, 194, 255)
    median = np.median(pixels, axis=0).astype(int)
    return (int(median[0]), int(median[1]), int(median[2]), 255)


def skin_patch_layer(
    size: tuple[int, int],
    skin: tuple[int, int, int, int],
    boxes: list[tuple[int, int, int, int]],
    blur: int = 9,
) -> Image.Image:
    alpha = Image.new("L", size, 0)
    draw = ImageDraw.Draw(alpha)
    for box in boxes:
        draw.rounded_rectangle(box, radius=max(4, (box[2] - box[0]) // 4), fill=255)
    alpha = alpha.filter(ImageFilter.GaussianBlur(blur))
    layer = Image.new("RGBA", size, skin)
    layer.putalpha(alpha)
    return layer


def make_body_base(character: Image.Image, skin: tuple[int, int, int, int]) -> Image.Image:
    base = character.copy()
    patches = skin_patch_layer(
        character.size,
        skin,
        [
            (400, 137, 458, 181),
            (470, 132, 536, 176),
            (437, 214, 487, 242),
        ],
        blur=8,
    )
    base.alpha_composite(patches)
    return base


def make_hair_front(character: Image.Image) -> Image.Image:
    arr = np.array(character)
    rgb = arr[..., :3]
    alpha = arr[..., 3]
    h, w = alpha.shape
    yy, xx = np.mgrid[:h, :w]
    dark = (rgb[..., 0] < 95) & (rgb[..., 1] < 95) & (rgb[..., 2] < 105)
    head_area = (xx > 230) & (xx < 735) & (yy < 720)
    # Bias toward bangs and long front strands; this is a draft extraction, not
    # a production mask.
    front_bias = (yy < 380) | (((xx < 430) | (xx > 545)) & (yy < 720))
    mask = (alpha > 20) & dark & head_area & front_bias
    out = arr.copy()
    out[..., 3] = np.where(mask, alpha, 0).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    # Feather tiny hard threshold artifacts without shifting the layer.
    a = img.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    img.putalpha(a)
    return img


def make_extracted_layer(src: Image.Image, boxes: list[tuple[int, int, int, int]]) -> Image.Image:
    layer = Image.new("RGBA", src.size, (0, 0, 0, 0))
    for box in boxes:
        paste_feathered(layer, src, box, radius=7)
    return layer


def make_eye_diff(
    size: tuple[int, int],
    skin: tuple[int, int, int, int],
    mode: str,
) -> Image.Image:
    layer = skin_patch_layer(
        size,
        skin,
        [(398, 135, 461, 183), (468, 130, 538, 178)],
        blur=5,
    )
    draw = ImageDraw.Draw(layer)
    line = (48, 37, 39, 235)
    lash = (31, 26, 29, 210)
    if mode == "half":
        draw.arc((407, 151, 454, 181), 188, 350, fill=line, width=2)
        draw.arc((479, 145, 529, 176), 190, 350, fill=line, width=2)
        draw.line((415, 158, 408, 154), fill=lash, width=1)
        draw.line((523, 151, 530, 146), fill=lash, width=1)
    elif mode == "closed":
        draw.arc((407, 151, 454, 181), 190, 350, fill=line, width=3)
        draw.arc((479, 145, 529, 176), 190, 350, fill=line, width=3)
        draw.line((416, 160, 408, 155), fill=lash, width=1)
        draw.line((523, 153, 531, 148), fill=lash, width=1)
    else:
        raise ValueError(mode)
    return layer


def make_mouth_diff(
    size: tuple[int, int],
    skin: tuple[int, int, int, int],
    mode: str,
) -> Image.Image:
    layer = skin_patch_layer(size, skin, [(435, 211, 489, 246)], blur=5)
    draw = ImageDraw.Draw(layer)
    line = (122, 67, 70, 220)
    shadow = (72, 34, 42, 230)
    if mode == "smile":
        draw.arc((448, 219, 478, 238), 18, 162, fill=line, width=2)
    elif mode == "open":
        draw.ellipse((456, 222, 471, 236), fill=shadow)
        draw.arc((449, 216, 480, 237), 18, 162, fill=line, width=1)
    else:
        raise ValueError(mode)
    return layer


def save_layer(name: str, image: Image.Image) -> Path:
    path = OUT_DIR / f"{name}.png"
    image.save(path)
    return path


def add_layer(psd: PSDImage, image: Image.Image, name: str, visible: bool = True):
    layer = psd.create_pixel_layer(image, name=name, top=0, left=0)
    layer.visible = visible
    return layer


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    background = load_rgba(BACKGROUND_PATH)
    character = load_rgba(CHARACTER_PATH)
    original = load_rgba(ORIGINAL_PATH)
    chromakey = load_rgba(CHROMAKEY_PATH)

    if not all(img.size == background.size for img in [character, original, chromakey]):
        raise ValueError("All source images must share one canvas size")

    skin = sample_skin_color(character)
    body_base = make_body_base(character, skin)
    hair_front = make_hair_front(character)
    eyes_open = make_extracted_layer(character, [(397, 130, 462, 186), (466, 124, 541, 182)])
    eyes_half = make_eye_diff(character.size, skin, "half")
    eyes_closed = make_eye_diff(character.size, skin, "closed")
    mouth_neutral = make_extracted_layer(character, [(432, 208, 493, 249)])
    mouth_smile = make_mouth_diff(character.size, skin, "smile")
    mouth_open = make_mouth_diff(character.size, skin, "open")

    layer_images = {
        "background": background,
        "body_full_visible": character,
        "body_base_blank_face": body_base,
        "hair_front_draft": hair_front,
        "eyes_open": eyes_open,
        "eyes_half": eyes_half,
        "eyes_closed": eyes_closed,
        "mouth_neutral": mouth_neutral,
        "mouth_smile": mouth_smile,
        "mouth_open": mouth_open,
        "reference_original": original,
        "reference_chromakey": chromakey,
    }

    for name, image in layer_images.items():
        save_layer(name, image)

    psd = PSDImage.new("RGB", background.size, color=(255, 255, 255))
    psd.clear()
    psd.extend(
        [
            add_layer(psd, background, "VISIBLE - background"),
            add_layer(psd, character, "VISIBLE - body_full"),
            add_layer(psd, hair_front, "VISIBLE - hair_front_draft"),
            add_layer(psd, body_base, "OPTION - body_base_blank_face_for_expression", visible=False),
            add_layer(psd, eyes_open, "OPTION - eyes_open", visible=False),
            add_layer(psd, eyes_half, "OPTION - eyes_half", visible=False),
            add_layer(psd, eyes_closed, "OPTION - eyes_closed", visible=False),
            add_layer(psd, mouth_neutral, "OPTION - mouth_neutral", visible=False),
            add_layer(psd, mouth_smile, "OPTION - mouth_smile", visible=False),
            add_layer(psd, mouth_open, "OPTION - mouth_open", visible=False),
            add_layer(psd, original, "REFERENCE - original merged page", visible=False),
            add_layer(psd, chromakey, "REFERENCE - chromakey source", visible=False),
        ]
    )
    psd.save(OUT_PSD)

    preview = Image.alpha_composite(background, character)
    for image in [hair_front]:
        preview.alpha_composite(image)
    preview.save(OUT_PREVIEW)

    print(f"Skin sample: {skin}")
    print(f"Wrote {OUT_PSD}")
    print(f"Wrote {OUT_PREVIEW}")
    print(f"Wrote layer PNGs under {OUT_DIR}")


if __name__ == "__main__":
    main()
