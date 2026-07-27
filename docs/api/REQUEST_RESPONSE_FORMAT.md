# Request and Response Payload Formats

## Purpose
Exhibits clean, concrete examples of standard payload schemas for our primary endpoints to guide front-end and back-end synchronization.

## Scope
Applies to client-side fetch payloads and server response serializers.

## Data Exchange Blueprints

### 1. Document Compile Endpoint: `POST /api/export/po`
Used to trigger server-side docx template synthesis.

* **Request Body:**
  ```json
  {
    "poId": "uuid-789-abc",
    "format": "word",
    "notes": "Include additional shipping instructions in footer"
  }
  ```

* **Response (Success - Streamed Buffer):**
  * Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  * Body: Binary Buffer Stream

* **Response (Validation Error):**
  * Status: `400 Bad Request`
  * Body:
    ```json
    {
      "error": "Purchase order uuid-789-abc is not approved. Exports require 'Approved' status."
    }
    ```

### 2. General Listing Payload
Used when fetching tables with pagination.
* **Query Parameters:** `?page=1&limit=20&search=SMEI-PO`
* **Response Body:**
  ```json
  {
    "data": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 120,
      "totalPages": 6
    }
  }
  ```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Revise when introducing any query serialization updates.
