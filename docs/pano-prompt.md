# Panorama prompt template — v1.0 (single time of day)

Goal: one painted background for the window, matching `docs/visual-spec.md`.
Generate 3–4 variants, pick one, upscale, save as `assets/panorama/bay-view.jpg`
(cover-fitted into a 1.4 × 0.96 window, so keep the interesting content in the
middle 80% of the frame).

## Prompt (EN)

```
Anime background art in the style of a Makoto Shinkai film, hand-painted look.
View from a hillside house window over a Japanese coastal town: a calm blue bay
fills the upper half with small fishing boats, green forested hills frame the
bay on both sides, low houses with tiled roofs and power lines in the lower
third, a white guardrail along the shore road. Late afternoon golden light,
warm sunlight from the left, long soft shadows, pale blue sky with a few
cumulus clouds, atmospheric haze toward the horizon. Painterly detail, delicate
line work, gentle color grading, cinematic composition, no people, no text.
High resolution, sharp focus, natural perspective.
```

## Negative prompt hints

```
text, watermark, signature, logo, people, characters, distorted perspective,
fisheye, window frame, border, vignette, blurry, oversaturated neon, night
```

## Technical checklist

- Aspect: 3:2 (e.g. 2160 × 1440), landscape; center-weighted composition.
- Save at ≥ 2048 px wide; AVIF/WebP if smaller file size matters.
- Keep sky/sea horizon roughly at the vertical center of the image.
- The left sash seam of our window sits at ~27% from the left edge — avoid
  placing a key subject exactly there.
- Later time-of-day states (post-v1.0) must reuse this exact composition:
  generate from the approved image with img2img, changing only lighting.
