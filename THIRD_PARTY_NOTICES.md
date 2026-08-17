# Third-party notices

Orbit includes work from the projects below. Their license terms are reproduced here as
those licenses require.

---

## bloub

The `bloub` skin (`src/skin-bloub.js`) is derived from **bloub** by Jérémy Perret —
an SVG recreation of the x.ai bot avatar.

- Source: https://github.com/jeremy-prt/bloub
- Demo: https://bloub.vercel.app
- License: MIT

**What Orbit uses:** the cloud silhouette's vector path data, and the eye proportions,
drift and blink behaviour measured from that artwork. The path data is embedded verbatim
in `src/skin-bloub.js`; the surrounding rendering, state mapping and rim lighting are
Orbit's own.

**Note on lineage:** bloub is itself a recreation of the x.ai bot avatar, so this skin's
shape ultimately derives from xAI's mascot design. Orbit is not affiliated with or
endorsed by xAI.

```
MIT License

Copyright (c) 2026 Jérémy Perret

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
