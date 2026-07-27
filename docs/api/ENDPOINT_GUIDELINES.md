# Endpoint Design Guidelines

## Purpose
Provides a step-by-step development process for designing, creating, validating, and testing new REST API endpoints.

## Scope
Applies to all software changes introducing or modifying API routes in the Express server.

## Endpoint Implementation Steps

### Step 1: Input Validation
Validate request query parameters (`req.query`), body payloads (`req.body`), and headers (`req.headers`) first using clean validation functions or structured schemas.

### Step 2: Authentication & Role Check
Ensure the incoming bearer token is valid and checking if the user role contains required scopes before initiating core database transactions.

### Step 3: Transaction Execution
Perform targeted Firestore operations inside a secure transaction block to prevent concurrent write collisions or fragmented document states.

### Step 4: Clean Response Compilation
Prepare and return standard status responses, logging execution statistics, and cleaning transient variables from system memory.

## Code Blueprint
```ts
// Example Express Endpoint
app.post("/api/purchase-orders", async (req, res) => {
  try {
    const { orderData } = req.body;
    if (!orderData || !orderData.supplierId) {
      return res.status(400).json({ error: "Missing required supplierId field" });
    }
    
    const newPO = await createPurchaseOrderInDb(orderData);
    return res.status(201).json(newPO);
  } catch (error) {
    console.error("[ERROR] Failed to compile PO: ", error);
    return res.status(500).json({ error: "Failed to create Purchase Order" });
  }
});
```

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Update if adding automatic schema validator middlewares like Joi or Zod.
