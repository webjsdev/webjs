---
name: webjs-instagram-post
description: >
  Publish an SEO post to the WebJs Instagram account (@webjs_dev). Use this
  skill whenever the user asks to post to Instagram, publish an Instagram
  post, share something on Instagram, or promote a page/feature/blog on
  Instagram for SEO. Every post is strictly for SEO reach, so every post
  MUST ship a freshly created branded image plus a keyword-rich caption.
  The skill holds the account id, the credential location, the image recipe,
  the public-hosting requirement, and the two-step publish flow. It never
  prints or commits the access token.
allowed-tools: Bash(curl:*), Bash(magick:*), Bash(convert:*), Bash(identify:*), Bash(cp:*), Bash(mkdir:*), Bash(ls:*), Bash(git:*), Read, Write
---

# Post to Instagram for SEO

Every Instagram post on the WebJs account exists for SEO reach, not for
personal updates. So each post carries two things you build here: a freshly
created branded image, and a keyword-rich caption that names the capability
and links back to a webjs.dev page. Never publish a plain-text post and never
reuse a stale image.

## Account and API

- **Account** is the `@webjs_dev` professional (BUSINESS) account.
- **Numeric user id** is `17841441038146182`. On `graph.instagram.com` you can
  also address it as `me`.
- **API flavor** is the Instagram API with Instagram Login, so every call goes
  to `https://graph.instagram.com/v25.0/...` with a long-lived USER access
  token. An app token (the `appid|secret` shape) can never post.

## Credentials (never printed, never committed)

The token lives in a gitignored file OUTSIDE the repo:

```
~/.config/webjs/instagram.env
```

with `IG_TOKEN`, `IG_USER_ID`, and `IG_APP_SECRET`. Source it inside a script
and reference `${IG_TOKEN}`. NEVER `cat`, `echo`, or otherwise print the file,
and NEVER copy the token into the repo, a commit, or a chat message. If the
file is missing, ask the user to generate a long-lived user token from the
Meta dashboard and place it there.

```sh
set -a; . ~/.config/webjs/instagram.env; set +a
```

## Step 1: create the branded SEO image (required, JPEG)

The Instagram publishing API accepts a **JPEG only**, pulled from a public URL.
Build a 1080x1080 branded card in the WebJs orange with a short headline. Keep
the headline inside the centre so a feed crop never clips it. Adjust
`HEADLINE` per post.

```sh
SLUG="why-webjs"                 # kebab-case, becomes the filename
HEADLINE="Build on the platform,\nnot against it"
OUT="/tmp/${SLUG}.jpg"

magick -size 1080x1080 -define gradient:angle=135 gradient:'#FF8C3A'-'#DE5F10' \
  \( -size 1080x1080 radial-gradient:'#00000000'-'#00000033' \) -composite \
  \( -background none -fill white -font Adwaita-Sans-ExtraBold -kerning -4 \
     -size 900x520 -gravity center caption:"$HEADLINE" \) \
  -gravity center -composite \
  \( -background none -fill 'white' -font Adwaita-Sans-Bold \
     -size 620x -gravity center label:'webjs.dev' \) \
  -gravity south -geometry +0+70 -composite \
  -quality 90 "$OUT"
identify -format '%wx%h %m\n' "$OUT"
```

The brand orange is a `#FF8C3A` to `#DE5F10` diagonal gradient. The wordmark
font `Adwaita-Sans-ExtraBold` matches the site treatment. Sanity-check the
render by reading `$OUT` back before publishing.

## Step 2: host the image at a public HTTPS URL

Meta fetches the image server-side, so it MUST sit at a public HTTPS URL before
you publish. The on-brand, SEO-positive route is to commit it into the website
and deploy, which also lands a real asset on webjs.dev:

1. Copy the JPEG to `website/public/social/<slug>.jpg` in a worktree.
2. Commit, push, open a PR, and after merge Railway serves it at
   `https://webjs.dev/public/social/<slug>.jpg`.
3. Confirm the URL returns `200` with `content-type: image/jpeg` before Step 4.

For a quick one-off where a deploy is too heavy, any public HTTPS host works,
as long as the final URL is reachable and serves real JPEG bytes.

## Step 3: write the SEO caption

- First line names the capability with the primary keyword, since the first
  line is what search and the feed show.
- Add a short body that expands the value in plain words.
- Close with a bare `webjs.dev/<path>` reference (Instagram captions are not
  clickable, but the text is still indexable and it drives to the bio link).
- Append a focused hashtag set. Reuse a core set and add a few per-topic ones,
  for example `#webdevelopment #javascript #webcomponents #framework #ssr
  #frontend #buildless #aicoding`.

Keep it honest about what WebJs does. Do not oversell, and do not frame a
WebJs feature as another tool's branded feature.

## Step 4: publish (confirm first, it is public)

Publishing is public and hard to undo, so ALWAYS confirm the exact image and
caption with the user before this step. Check the quota first (limit is 25 per
rolling 24 hours).

```sh
set -a; . ~/.config/webjs/instagram.env; set +a
IMG="https://webjs.dev/public/social/why-webjs.jpg"
CAP="Build on the platform, not against it. WebJs is a no-build, web-components-first framework. webjs.dev/why #webdevelopment #javascript #webcomponents"

# quota
curl -s "https://graph.instagram.com/v25.0/me/content_publishing_limit?access_token=${IG_TOKEN}"

# 1) create the media container
CREATE=$(curl -s "https://graph.instagram.com/v25.0/me/media" \
  --data-urlencode "image_url=${IMG}" \
  --data-urlencode "caption=${CAP}" \
  --data-urlencode "access_token=${IG_TOKEN}")
echo "$CREATE"
CREATION_ID=$(printf '%s' "$CREATE" | grep -oE '"id":"[0-9]+"' | head -1 | grep -oE '[0-9]+')

# 2) publish the container
curl -s "https://graph.instagram.com/v25.0/me/media_publish" \
  --data-urlencode "creation_id=${CREATION_ID}" \
  --data-urlencode "access_token=${IG_TOKEN}"
echo
```

Only the API JSON is ever printed, so the token stays out of the transcript.
A successful publish returns the new media id. Report that id to the user.

## Token refresh (keeps the account posting)

A long-lived token lasts 60 days and is refreshable any time after it is 24
hours old. Refresh on a schedule so it never lapses:

```sh
set -a; . ~/.config/webjs/instagram.env; set +a
curl -s "https://graph.instagram.com/v25.0/refresh_access_token?grant_type=ig_refresh_token&access_token=${IG_TOKEN}"
```

Then write the returned token back into `~/.config/webjs/instagram.env` without
printing it.

## The profile avatar asset

`assets/webjs-instagram-avatar.png` is the 1080x1080 profile picture for the
account. It is full-bleed brand orange with the white `webjs` wordmark, so
Instagram's circular crop yields a clean filled circle rather than the clipped
squircle the old favicon produced. It is set manually in the Instagram app (the
publishing API cannot change a profile picture). Regenerate it with:

```sh
magick -size 1080x1080 -define gradient:angle=135 gradient:'#FF8C3A'-'#DE5F10' base.png
magick -background none -fill white -font Adwaita-Sans-ExtraBold -kerning -8 \
  -size 800x -gravity center label:'webjs' wordmark.png
magick base.png wordmark.png -gravity center -composite \
  assets/webjs-instagram-avatar.png
```
