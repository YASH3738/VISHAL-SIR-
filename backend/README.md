# Legacy Express backend

This directory is retained temporarily for rollback and data-model reference.
The active architecture is Firebase Hosting, Firestore, and the HTTPS Function
in `../functions`; do not deploy this Express service as the production API.

The legacy backend no longer sends appointment-completion WhatsApp messages.
Use the root [Firebase deployment guide](../FIREBASE_DEPLOYMENT.md) for the
current deployment steps and required Functions secret names.

Do not delete this directory until the Firebase migration has been deployed
and its appointment, payment, patient-login, and admin flows have been verified.
