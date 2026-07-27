# Database Schema Migrations

## Purpose
Explains how to execute data seeding, collection refactoring, field updates, and database index compilation.

## Scope
Applies to system updates, index configurations, and structural database upgrades.

## Seeding & Index Deployment

### 1. Adding Composite Indexes
If a query uses multiple fields (e.g. where status is 'Approved' order by createdAt desc), you must build composite indexes.
* Deploy Firestore index maps:
  ```bash
  firebase deploy --only firestore:indexes
  ```

### 2. Seeding Sample Procurement Data
* Run the node utility script to fill local or staging databases with test suppliers and initial items:
  ```bash
  npm run db:seed
  ```

## Best Practices
* **Zero Downtime Migrations:** When modifying field names, deploy a double-write strategy (writing both old and new fields simultaneously) before deprecating old attributes.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Must be revised whenever a seeding file or custom indexing logic is changed.
