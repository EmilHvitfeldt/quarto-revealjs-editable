# Local compatibility change

Upstream: emilhvitfeldt/quarto-revealjs-editable v9.0.0.

The modify-mode classifier uses `Reveal.getCurrentSlide()` so vertical slides
select their own elements rather than the first slide in the enclosing stack.
Modify-mode source lookup uses that slide's `editableSourceIndex` rather than its
horizontal navigation index. The Lua filter marks each rendered slide heading
with its index in expanded QMD. Project scripts may also preserve an original
slide ID before nesting; the client can map that ID or a unique title when a
previously rendered deck has no index marker. This preserves the serializer's
source chunk numbering across projects and reordered slides.

Server autosave is implemented in `src/server-sync.js`; `presentation_edit_server.py`
serves the deck, accepts revision-checked edits, preserves source includes, keeps
backups and runs Quarto. Saves use the cumulative original browser baseline;
successful responses update only the server revision, preventing duplicate
insertions on subsequent saves. Failed saves stay visibly unsaved. The endpoint
is same-origin and requires the session token supplied by the editor server.

The Lua filter expands includes for portable offline editing. When the server
is available its boundary-marked source bundle replaces that baseline, allowing
the server to write each edit to its owning QMD file. Before any slide nesting,
the Lua heading marker maps rendered slides directly to expanded source headings,
including cloned or reordered supplemental slides.

Raw HTML images and videos retain their authored classes, fragment attributes,
playback settings and grid/flex footprint. Geometry is saved as relative offsets
for items in normal layout, or absolute coordinates for positioned items.

Visible Undo/Redo buttons stay available when a context panel is open. Undo
captures native-element activation as well as geometry edits, restoring original
DOM placement and attributes; redo reuses the same nodes and event listeners.
Restoring history triggers server autosave. Clicks without movement do not add
empty move/resize entries or discard redo history. Media sizes are resolved
before wrapping, using untransformed CSS pixels rather than rotated bounding
boxes. Selection outlines do not affect layout size.

`src/text-editing.js` adds source-backed in-place movement and inline content
editing for raw HTML labels, symbols, code and Markdown headings. **Edit text**
and double-click enter editing. `text-source.js` locates authored HTML without
rewriting comments, code fences, unrelated attributes or existing transforms.
Mixed text/media containers isolate only the selected direct text run. Duplicate
labels use source occurrence identity; cloned supplemental slides share a source
key so selecting a second copy cannot overwrite an existing edit. Undo restores
the original DOM and content, and server saving includes the text changes.

**Diagram parts** selects internal SVG boxes and arrows. Boxes carry their
contained graphics and labels; arrows carry separate arrowheads. External SVGs
are inlined only for part editing, with scoped styles and private marker IDs.
Actual edits are saved as inline SVG in the owning QMD slide, leaving generated
SVG assets intact. Turning part editing off allows the whole inline diagram to
move. Scrollable protocol overlays stay attached to their design boxes.
Undo/Redo and server saving cover both forms of movement, including cloned
supplemental slides. Decimal media dimensions are preserved, and activation
retains the displayed size before theme constraints are removed.

Selected diagram parts now expose eight high-contrast corner/edge resize
handles. Handles stay in screen pixels while the resize uses SVG coordinates,
so Reveal zoom and transformed diagram groups do not distort pointer movement.
Boxes scale their labels and contents together; arrows retain separate heads.
Shift preserves proportions. Part transforms are composed with the original
authored transform, then serialized as inline SVG through the existing server
save path, including reconciliation across duplicate supplemental slides.
Undo/Redo restores both movement and resizing. With Diagram parts disabled,
the same handles resize the complete inline diagram.
