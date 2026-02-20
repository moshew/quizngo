# pptx2base64

Python utility that converts a PPTX file into base64 bytes for `insertSlidesFromBase64`.

## Structure

- `pptxs/` - place input `.pptx` files here
- `output/` - generated `.bin` files

## Usage

```bash
python utils/pptx2base64/run.py my-slides.pptx
```

Or without extension:

```bash
python utils/pptx2base64/run.py my-slides
```

Custom output filename:

```bash
python utils/pptx2base64/run.py my-slides.pptx --output imported.bin
```

The output file contains raw base64 bytes (no `data:` prefix), ready to decode to string and pass to `insertSlidesFromBase64`.
