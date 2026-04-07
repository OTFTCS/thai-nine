# Manim Pipeline Lessons Learned

## 1. Subtitle displayEnd vs Manim duration

**Problem:** Subtitle overlays use `displayEnd` = end of the entire block (so items stay visible concurrently in a subtitle renderer). When these values are naively used as Manim durations (`displayEnd - displayStart`), sequential method calls accumulate massive time — a vocab card that should show for 8s before the next word ends up holding for 300s.

**Fix:** Pre-compute `manimDuration` = time from this overlay's `displayStart` to the next overlay's `displayStart` within the same block. Only the last overlay in a block uses `displayEnd`. This is done in `generate_scene.py::_preprocess_overlays()`.

**Rule:** Never pass raw `displayEnd - displayStart` to Manim methods when overlays within a block are designed to coexist on screen. Always compute sequential durations.

## 2. Manim layer cleanup — always remove before replace

**Problem:** Setting `self._primary = new_card` updates the Python reference but does NOT remove the old mobject from Manim's scene graph. Old text stays rendered on screen, causing overlapping garbage.

**Fix:** Use `_set_layer(attr, obj)` helper that calls `self.remove(old)` before `setattr(self, attr, obj)`. Every `show_*` method must go through this helper.

**Rule:** In Manim, `self.remove(obj)` is required to stop rendering a mobject. Assignment to a Python variable is not enough. Always remove before replace.

## 2b. Always add/animate the tracked object, not a child

**Problem:** If you track `VGroup(label)` on a layer but do `self.add(label)` or `self.play(FadeIn(label))`, you're adding the raw child to the scene independently of the VGroup. When `_set_layer` removes the VGroup, the independently-added label stays rendered.

**Fix:** Always add/animate the same object that's stored on the layer. If you set `_set_layer("_secondary", VGroup(label))`, then do `self.add(group)` and `self.play(FadeIn(group))`, not `self.add(label)`.

**Rule:** The object you add to the scene must be the same object you track for removal. Never add a child independently of its parent wrapper.

## 3. Nested submobject opacity animation

**Problem:** Using `submobject.animate.set_opacity(1)` on a child inside a VGroup inside a TextCard may not propagate correctly across Manim backends (Cairo vs OpenGL).

**Fix:** Use `FadeIn(submobject)` instead of `submobject.animate.set_opacity(1)` for nested elements.

## 4. Accumulated mobject tracking

**Problem:** In `show_accumulate()`, calling `self.remove(vgroup)` removes the VGroup wrapper but not the individual label mobjects inside it. When re-added in a new VGroup, Manim may double-track them.

**Fix:** Remove individual old labels explicitly before creating the new VGroup: `for label in old_labels: self.remove(label)`.

## 5. Claude CLI PATH when called from subprocess

**Problem:** `/opt/homebrew/bin/python3` doesn't have `/usr/local/bin` in its PATH, so `shutil.which("claude")` fails even though `claude` is installed at `/usr/local/bin/claude`.

**Fix:** Ensure PATH includes both `/opt/homebrew/bin` and `/usr/local/bin` when running the pipeline.
