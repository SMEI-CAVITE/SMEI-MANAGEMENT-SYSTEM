# Layout Guidelines & Page Blueprints

## Purpose
Defines standard blueprint templates for both split workspace directories and modal overlays.

## Scope
Applies to overall page construction in React.

## Blueprint Template: Split-View Workspace
```tsx
export const SplitWorkspaceTemplate: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100">
        <h1 className="text-xl font-sans font-medium text-gray-900">Module Table</h1>
      </div>

      {/* 2. Split Workspace (40% Table / 60% Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Table */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="w-full text-left">
              {/* Table Data */}
            </table>
          </div>
        </div>

        {/* Right Side: Live Document Preview */}
        <div className="lg:col-span-7 h-[calc(100vh-280px)] min-h-[500px] sticky top-6">
          <DocumentPreview moduleName="po" data={selectedData} />
        </div>
      </div>
    </div>
  );
};
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Must be revised if the global layout container rules or page gutters are updated.
