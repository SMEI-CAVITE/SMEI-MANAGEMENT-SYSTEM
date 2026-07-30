const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  projectId: "smei-system2026",
});

const db = getFirestore("ai-studio-smeimanagementsy-8c9367c0-7b52-420a-909f-458a4133d35a");
db.collection("users").get().then(console.log).catch(console.error);
