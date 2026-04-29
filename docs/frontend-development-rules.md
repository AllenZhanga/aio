# Frontend Development Rules

## Structure

- `App.tsx` is only the application shell and cross-page coordinator: route selection, auth/session, shared runtime keys, and handing page hooks into page components.
- Page-owned state and API actions live with the page as `use<PageName>Page` hooks under `apps/web/src/components/` until the module becomes large enough to promote to a feature folder.
- Shared render primitives live in `components/ui.tsx`; page components should compose them instead of inventing one-off shells for drawers, lists, empty states, notices, and code blocks.
- Shared data types live in `types.ts`; definition builders and route helpers stay outside components.

## Forms

- Create and edit flows open in a right-side `Drawer`. Do not place create/edit forms inline inside list pages.
- Page-level inline inputs are allowed only for filtering, searching, lightweight test queries, and table/list controls.
- Drawer footers contain the primary save action and cancel action. Destructive actions stay in the list row or detail surface and must confirm before executing.
- Secret values use password inputs and may be left blank on edit to keep existing backend secrets.

## Lists

- Lists use a scannable row layout: primary title, stable id/subtitle, status pill, metadata, and a right-aligned action group.
- Use one row per entity. Avoid card grids for operational lists unless the content is naturally visual or comparison-oriented.
- Every list must provide loading, empty, and error states. Empty states should say what action creates the first item.
- Row click selects or opens details; row action buttons must stop accidental navigation when needed.
- Status labels should reuse existing `runStatus` tones where possible: `success`, `running`, `pending`, `cancelled`, `failed`.

## Workflow

- Workflow canvas state belongs in a workflow-specific hook, not in `App.tsx`.
- Node configuration editing should use structured controls for known fields where possible. Raw JSON/text areas are acceptable for advanced fields, but should not be the only interaction for common settings.
- Node creation, connection, deletion, and validation behavior should remain in the workflow module so publishing logic receives a ready definition.

## Knowledge

- Dataset creation and document ingestion use side drawers.
- The knowledge page primary view is a dataset list plus selected dataset detail.
- Document list rows show name, id, source type, index status, updated time, and actions when available.
- Retrieval testing is an inline operational control because it is a query against the selected dataset, not entity creation.
