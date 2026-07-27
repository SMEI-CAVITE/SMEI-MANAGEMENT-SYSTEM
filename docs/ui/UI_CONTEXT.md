# UI Context: Client Architecture & Workspace Layouts

## Purpose
Establishes the design paradigms, visual hierarchies, and layout structures used to display active data blocks, dynamic directories, and real-time document preview workspaces.

## Scope
Applies to all screens, overlays, dashboards, and modal interfaces inside the React client app.

## Layout Concepts
The client application uses two principal user experience layouts:
1. **Dynamic Split-View Directory (Enterprise Standard):** Maps a 5-column listing table on the left side with a sticky, high-DPI live document preview on the right side.
2. **Side-by-Side Form Workspace:** Automatically collapses the main navigation sidebar to allow an elegant, wide layout where editing forms sit on the left (6-cols) and live previews sit on the right (6-cols).

## Rules & Standards
* **Immediate Updates:** When typing inside any input box, the live preview must refresh instantly without requiring manual save or export commands.
* **No Hardcoded Sizing:** Fluid spacing calculations (e.g., `h-[calc(100vh-280px)]`) must be applied globally to eliminate blank vertical space.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Re-examine upon introducing drag-and-drop dashboard widgets or multi-view reporting pipelines.
