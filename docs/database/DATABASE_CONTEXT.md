# Database Context: Cloud Firestore

## Purpose
Explains the design pattern, querying limits, performance metrics, and caching strategies applied to Cloud Firestore, our primary enterprise cloud database.

## Scope
Applies to all database reading, writing, and synchronization logic inside both the React client and Express server.

## Database Philosophy: Firestore NoSQL
To support instant synchronization and responsive updates, the Procurement System uses Cloud Firestore. Key paradigms include:
1. **Document-Centric Storage:** Related data is grouped into flat, clean documents rather than highly fragmented normalized tables.
2. **Real-time Subscriptions:** The client subscribes to collections via `onSnapshot` for real-time document sync.
3. **Optimized Indexes:** Composite indexes are defined in `firestore.indexes.json` to prevent query bottlenecks.

## Rules & Standards
* **No Direct Client Mutations on Locked Data:** React components are forbidden from mutating records marked with immutable states (e.g. `status: "Approved"`). All sensitive updates must go through server-side Express routes that run transactions.
* **Denormalization Limit:** Denormalization (duplicating fields like supplier name inside a PO document) is only permitted for non-volatile read-only data to avoid complex cross-document updates.

## Notes for AI Assistants
* Do not write arbitrary fields inside collections. All new attributes must be documented in `DATABASE_SCHEMA.md` first.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revised when upgrading database tiers or adding composite querying indexes.
