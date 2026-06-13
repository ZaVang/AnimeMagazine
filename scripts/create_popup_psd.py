from pathlib import Path

from PIL import Image
from psd_tools import PSDImage


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "assets" / "image"

SOURCES = {
    "background": IMAGE_DIR / "1-background-only.png",
    "character": IMAGE_DIR / "1-character-transparent.png",
    "original": IMAGE_DIR / "1.png",
    "chromakey": IMAGE_DIR / "1-character-chromakey.png",
}

OUT_PSD = IMAGE_DIR / "1-popup-standee.psd"
OUT_PREVIEW = IMAGE_DIR / "1-popup-standee-preview.png"


def open_layer(path: Path, mode: str = "RGBA") -> Image.Image:
    image = Image.open(path)
    return image.convert(mode)


def assert_same_size(images: dict[str, Image.Image]) -> tuple[int, int]:
    sizes = {name: image.size for name, image in images.items()}
    unique = set(sizes.values())
    if len(unique) != 1:
        details = ", ".join(f"{name}={size}" for name, size in sizes.items())
        raise ValueError(f"All PSD layers must share one canvas size: {details}")
    return next(iter(unique))


def main() -> None:
    images = {
        "background": open_layer(SOURCES["background"]),
        "character": open_layer(SOURCES["character"]),
        "original": open_layer(SOURCES["original"]),
        "chromakey": open_layer(SOURCES["chromakey"]),
    }
    size = assert_same_size(images)

    psd = PSDImage.new("RGB", size, color=(255, 255, 255))

    background = psd.create_pixel_layer(
        images["background"],
        name="VISIBLE - page background without character",
        top=0,
        left=0,
    )
    character = psd.create_pixel_layer(
        images["character"],
        name="VISIBLE - pop-up character transparent",
        top=0,
        left=0,
    )
    original = psd.create_pixel_layer(
        images["original"],
        name="REFERENCE - original merged page",
        top=0,
        left=0,
    )
    chromakey = psd.create_pixel_layer(
        images["chromakey"],
        name="REFERENCE - chromakey source",
        top=0,
        left=0,
    )

    original.visible = False
    chromakey.visible = False

    # Keep the visible layers first for runtimes that read top-to-bottom; the
    # hidden references are still available for manual cleanup in an editor.
    psd.clear()
    psd.extend([background, character, original, chromakey])
    psd.save(OUT_PSD)

    preview = Image.alpha_composite(images["background"], images["character"])
    preview.save(OUT_PREVIEW)

    print(f"Wrote {OUT_PSD}")
    print(f"Wrote {OUT_PREVIEW}")


if __name__ == "__main__":
    main()
