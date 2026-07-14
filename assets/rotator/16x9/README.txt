# Mario Mania Rotator Folder Setup

Each overlay layout uses a unique rotator size, so every layout should have its own rotator image folder.

## Folder Structure

Create the following folders inside `assets/rotator/`:

```text
assets/
└── rotator/
    ├── 16x9/
    ├── 4x3/
    ├── 3x2/
    ├── 10x9/
    ├── ds/
    ├── 3ds/
    └── four-player/
```

The five-commentator overlay does not use a rotator, so it does not need a folder.

## Image Naming

Use the same filenames in every layout folder.

Example:

```text
assets/rotator/16x9/march-of-dimes.png
assets/rotator/4x3/march-of-dimes.png
assets/rotator/3x2/march-of-dimes.png
```

The image dimensions may differ, but the filenames should stay identical.

Recommended filenames:

```text
march-of-dimes.png
donate.png
merch.png
event-info.png
```

## Moving the Existing Images

The current rotator images stored directly in:

```text
assets/rotator/
```

should be moved into:

```text
assets/rotator/16x9/
```

Then create new versions for each remaining layout and place them in the matching folder.

## Layout Folder Names

Use these exact folder names:

| Overlay | Rotator folder |
|---|---|
| 16:9 | `16x9` |
| 4:3 | `4x3` |
| 3:2 | `3x2` |
| 10:9 | `10x9` |
| Nintendo DS | `ds` |
| Nintendo 3DS | `3ds` |
| Four-player | `four-player` |
| Five-commentator | No rotator |

## Important

Do not rename the same slide differently between folders. The overlay JavaScript will eventually choose the correct folder based on the page layout while continuing to use one shared `data/rotator.json` file.
