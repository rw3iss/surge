# @sitesurge/types

## 0.1.3

### Patch Changes

- Plugin-aware Content-Security-Policy: enabled plugins' widgets can reach their backend. connect-src is extended with each enabled plugin's type:'url' config origins, plus an optional manifest `csp` block (connect/script/style/img/frame). Fixes PageLoop being blocked from https://pageloop.dev.

## 0.1.2

### Patch Changes

- Admin/authoring features + fixes: Carousel "posts" items (post query → one slide per post, banner-image backdrop, show-fields author/excerpt/dates/tags with a line-clamped excerpt); post banner-image field; campaign "Show raised amount" toggle + no-goal rendering; plugin widget host mounts once at the app root (loads on admin + survives refresh); block editor no longer deselects on click-outside; shared post-query controls. Types: HeroPostsConfig/HeroPostMeta, campaign showRaisedAmount, nullable post featuredImage.
