# Firestore Security Rules Guide

## Purpose
Defines the client-side write validation rules and structural validation checks implemented to prevent unauthorized edits.

## Scope
Applies to the standard `firestore.rules` file used to secure the Firestore instance.

## Blueprint Rules (Example)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // User profile permissions helper
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    // Purchase orders access rules
    match /purchaseOrders/{poId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && getUserRole() in ['Buyer', 'Admin'];
      allow update: if request.auth != null && 
                    resource.data.status != 'Approved' && 
                    getUserRole() in ['Buyer', 'Admin'];
      allow delete: if request.auth != null && getUserRole() == 'Admin';
    }
  }
}
```

## Security Hardening Checklist
* Ensure all read requests are authenticated.
* Block client-side write access to approved or archived document records.
* Restrict field updates to match valid types.

## Maintenance Section
* **Last Updated:** July 2026
* **Trigger for Updates:** Review immediately upon updating roles or permissions matrix in the backend system.
