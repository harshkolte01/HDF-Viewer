# js/components/viewerPanel/render

Pure rendering layer for preview and full-view shell markup.

## What is implemented
- `config.js`: derives runtime config and selection keys from state + preview context.
- `dimensionControls.js`: renders dimension pickers, staged fixed-index sliders, and apply/reset controls.
- `previews.js`: generates table preview, SVG line preview, and sampled heatmap preview.
- `sections.js`: renders inspect panel, display panel sections, toolbars, and full runtime shell containers.

## How it is implemented
- Rendering is state-driven and side-effect free.
- Full runtimes are activated by embedding shell nodes with precise `data-*` attributes.
- Preview rendering provides immediate feedback while full runtimes fetch higher-resolution data.
