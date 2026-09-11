---
name: Legacy Reels media
description: Preserve historical media references while requiring ownership for new uploads.
---

Apply strict local-upload ownership rules to new and replaced Reel media, not unchanged historical references.

**Why:** Existing Reels include legacy remote references and missing local files. Retroactive validation would prevent owners from editing their titles without restoring old media first; deleting those rows would destroy content rather than repair storage.

**How to apply:** Keep historical playback and metadata-only edits compatible. Recover missing originals separately from backups with matching provenance; never silently replace users' content with generated media or delete posts to hide missing-file errors.