#!/usr/bin/env python3
"""Endereza foto de rejilla (naranja sobre hormigón) → 500×500 fondo blanco como trama/moneda."""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

OUT_SIZE = 500
TARGET_FILL = 0.93


def largest_orange_mask(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    mask1 = cv2.inRange(hsv, np.array([5, 70, 70]), np.array([28, 255, 255]))
    mask2 = cv2.inRange(hsv, np.array([0, 70, 70]), np.array([5, 255, 255]))
    mask = cv2.bitwise_or(mask1, mask2)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    return mask


def largest_contour(mask: np.ndarray):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    return max(contours, key=cv2.contourArea)


def replace_concrete_with_white(bgr: np.ndarray) -> np.ndarray:
    """Solo el hormigón gris → blanco. Mantiene naranja y huecos oscuros de la rejilla."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    gray_concrete = cv2.inRange(hsv, np.array([0, 0, 80]), np.array([180, 45, 200]))
    out = bgr.copy()
    out[gray_concrete > 0] = (255, 255, 255)
    return out


def straighten_and_crop(bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    cnt = largest_contour(mask)
    if cnt is None or cv2.contourArea(cnt) < 3000:
        raise ValueError('No se detectó la baldosa naranja en la foto')

    rect = cv2.minAreaRect(cnt)
    (cx, cy), (w, h), angle = rect
    if w < h:
        angle += 90
    M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
    rotated = cv2.warpAffine(
        bgr, M, (bgr.shape[1], bgr.shape[0]),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_REPLICATE,
    )
    rot_mask = cv2.warpAffine(
        mask, M, (mask.shape[1], mask.shape[0]),
        flags=cv2.INTER_NEAREST,
        borderMode=cv2.BORDER_CONSTANT,
    )
    ys, xs = np.where(rot_mask > 0)
    pad = 14
    y0, y1 = max(0, ys.min() - pad), min(rotated.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(rotated.shape[1], xs.max() + pad)
    crop = rotated[y0:y1, x0:x1]
    return replace_concrete_with_white(crop)


def frame_500(tile_bgr: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(tile_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    tw, th = img.size
    target = int(OUT_SIZE * TARGET_FILL)
    scale = min(target / tw, target / th)
    nw, nh = max(1, int(tw * scale)), max(1, int(th * scale))
    tile = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (OUT_SIZE, OUT_SIZE), (255, 255, 255))
    canvas.paste(tile, ((OUT_SIZE - nw) // 2, (OUT_SIZE - nh) // 2))
    return canvas


def process(src: Path, dest: Path) -> None:
    bgr = cv2.imread(str(src))
    if bgr is None:
        raise ValueError(f'No se pudo leer {src}')
    mask = largest_orange_mask(bgr)
    if mask.sum() < 3000:
        h, w = bgr.shape[:2]
        side = min(h, w)
        y0, x0 = (h - side) // 2, (w - side) // 2
        tile = bgr[y0:y0 + side, x0:x0 + side]
    else:
        tile = straighten_and_crop(bgr, mask)
    out = frame_500(tile)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, 'JPEG', quality=92, optimize=True)
    print(f'OK: {src} -> {dest}')


def main() -> None:
    if len(sys.argv) < 3:
        print('Uso: python3 scripts/process-rejilla-photo.py <entrada.jpg> <salida.jpg>')
        sys.exit(1)
    process(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == '__main__':
    main()
