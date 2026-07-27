# Folder Structure Standard

## Purpose
This document outlines the standard folder organization of the repository to maintain cleanliness, modularity, and rapid file navigation for developers and AI bots.

## Scope
Applies to the entire workspace directory including development assets, static templates, client code, and server configurations.

## Workspace Tree
```
├── .env.example                    # Environment variable template
├── package.json                    # Npm configuration and scripts
├── server.ts                       # Full-stack backend entrypoint (Express)
├── vite.config.ts                  # Vite build and asset configuration
├── docs/                           # Central Document Portal
│   ├── core/                       # Architectures, tech stack, and standards
│   ├── database/                   # Firestore schemas and rules
│   ├── api/                        # REST endpoint specs and formats
│   ├── ui/                         # Design system, forms, and layouts
│   ├── business/                   # Core business rules, validation, and permissions
│   ├── modules/                    # PO, PIS, RFS, Canvass module specs
│   └── ai/                         # Prompt guides, templates, and AI workflows
├── public/                         # Static assets and template files
│   └── templates/                  # Source docx/xlsx template files
└── src/                            # Main React Frontend Code
    ├── main.tsx                    # React client entry point
    ├── App.tsx                     # Main Router and core shell
    ├── index.css                   # Global Tailwind configuration
    ├── types.ts                    # Consolidated global TypeScript interfaces
    ├── components/                 # Reusable React UI blocks and views
    │   ├── DocumentPreview.tsx     # Standardized live document preview canvas
    │   ├── POList.tsx              # Purchase Order directory
    │   ├── POForm.tsx              # Purchase Order editor
    │   └── CanvassSheetModule.tsx  # Canvass directory and edit modal
    └── utils/                      # Helper libraries and document mappers
        └── templatePreview.ts      # HTML conversion and placeholder logic
```

## Structural Rules
1. **No Flat Files at Root:** All new functional components must reside in `/src/components/` and utility scripts in `/src/utils/`. Do not pollute the root directory.
2. **Template Storage:** Source export templates must be stored inside `/public/templates/` to allow clean backend streaming access.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** This directory map must be adjusted if a new primary directory (like `/src/hooks/` or `/src/context/`) is initialized.
