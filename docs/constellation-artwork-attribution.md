# Constellation line artwork attribution

The 64 new stick-figure constellations in `src/campaign/iau-unpublished-silhouettes.js` were adapted from:

- Project: **d3-celestial**, by Olaf Frohn and contributors
- Upstream: https://github.com/ofrohn/d3-celestial
- Source file: `data/constellations.lines.json` (upstream blob SHA `ce64cf3c18b627f4d9749b9076cd4693b777697e`)
- Repository license: three-clause BSD-style license, copyright (c) 2015 Olaf Frohn
- License text: https://github.com/ofrohn/d3-celestial/blob/master/LICENSE

## Transformation

Constellation polylines were grouped by IAU abbreviation, unique coordinate points were indexed, and segments were converted to point-index pairs. Right ascension/declination coordinates were projected to Lumen's 280 x 120 drawing viewbox with wraparound handling. The existing 24 Lumen silhouettes were **not** replaced.

## Publication checkpoint

The repository license grants redistribution and modification subject to retaining the copyright, conditions and disclaimer, and not implying endorsement. Before shipping this artwork in a commercial release, confirm whether the upstream constellation line dataset carries additional third-party data attribution or licensing requirements. The generated data currently remains in a preview-only workflow.

## Upstream license notice

Copyright (c) 2015, Olaf Frohn

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
