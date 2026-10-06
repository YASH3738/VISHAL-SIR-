# Production deployment

The production layout uses Firebase Hosting for the static website and a
Cloud Run service for the Express API. Firebase Hosting rewrites `/api/**` to
Cloud Run, so appointment checkout, the admin dashboard and the patient portal
use the same origin at `https://drvishalyogi.in`.

## One-time Google Cloud setup

1. Select the Firebase project `dr-vishal-clinic` in Google Cloud and enable
   Cloud Run, Cloud Build, Artifact Registry and Secret Manager APIs.
2. Create a Cloud Run runtime service account, for example
   `vishal-clinic-api@dr-vishal-clinic.iam.gserviceaccount.com`. Grant it
   `roles/datastore.user` on the project so the backend can use Firestore
   Application Default Credentials. Do not set
   `GOOGLE_APPLICATION_CREDENTIALS` on Cloud Run and do not upload a service
   account key.
3. Store these values in Secret Manager; never put them in frontend files,
   source control, Docker images or deployment command history:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `JWT_SECRET` (a long, randomly generated secret)
   - `ADMIN_PASSWORD` (at least 12 characters)
   - `WUAPI_API_KEY` (create a new key if the old one was shared)
   - `WUAPI_ACCOUNT_ID` (the connected Wuapi account ID)
4. Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor`
   on those secrets. The Razorpay key ID and secret must belong to the
   same account and use the intended Test or Live mode.
5. In Wuapi, verify the connected WhatsApp account is ready. The booking form
   asks patients to opt in to WhatsApp appointment messages; notifications are
   sent only for paid bookings where consent was recorded. A successful Wuapi
   response means the message was queued, not that WhatsApp delivered or read it.

## Deploy the API

From the project root, deploy the `backend` directory to the region configured
in `firebase.json` (`asia-south1`):

```sh
gcloud run deploy vishal-clinic-api \
  --source backend \
  --project dr-vishal-clinic \
  --region asia-south1 \
  --allow-unauthenticated \
  --service-account vishal-clinic-api@dr-vishal-clinic.iam.gserviceaccount.com \
  --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=dr-vishal-clinic,PORT=8080 \
  --set-secrets RAZORPAY_KEY_ID=razorpay-key-id:latest,RAZORPAY_KEY_SECRET=razorpay-key-secret:latest,JWT_SECRET=clinic-jwt-secret:latest,ADMIN_PASSWORD=clinic-admin-password:latest,WUAPI_API_KEY=wuapi-api-key:latest,WUAPI_ACCOUNT_ID=wuapi-account-id:latest
```

Replace the secret resource names on `--set-secrets` with the names created in
Secret Manager. The API has a lightweight `/api/health` endpoint for
availability checks.

For an already deployed Cloud Run service, add only the new Wuapi secrets and
deploy the updated backend without replacing its existing environment or secret
configuration:

```sh
gcloud run deploy vishal-clinic-api \
  --source backend \
  --project dr-vishal-clinic \
  --region asia-south1 \
  --update-secrets WUAPI_API_KEY=wuapi-api-key:latest,WUAPI_ACCOUNT_ID=wuapi-account-id:latest
```

## Deploy Hosting and connect the domain

1. Install the Firebase CLI, sign in with an account that can deploy Hosting,
   and deploy the updated static site:

   ```sh
   firebase deploy --only hosting --project dr-vishal-clinic
   ```

2. In Firebase Console → Hosting → Add custom domain, add `drvishalyogi.in`
   (and optionally `www.drvishalyogi.in`). Copy the DNS records Firebase gives
   you into the domain registrar. Do not guess or reuse DNS values from another
   project. Wait for Firebase to verify the domain and provision HTTPS.
3. The Firebase Hosting rewrite in `firebase.json` sends `/api/**` to the
   `vishal-clinic-api` Cloud Run service in `asia-south1`. Keep the browser API
   base URL blank for this same-origin setup. Verify both
   `https://drvishalyogi.in/` and `https://drvishalyogi.in/api/health` after
   deployment; the API health route must return HTTP 200 before testing login,
   payments, or WhatsApp notifications.
4. Set the intended Razorpay Test keys first and verify a complete test payment
   and appointment flow. Switch the two Razorpay secrets together to Live keys
   only after the test payment and confirmation succeed.

## Local development

For local development only, copy `.env.example` to `.env` in this directory,
set the required secrets and configure
`GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json`. Keep both
files out of source control. Start the API from the repository root:

```sh
node backend/server.js
```

When the pages are opened directly with `file://`, the appointment page uses
`http://localhost:5000`. Admin and patient portals should be tested through
Firebase Hosting or from a local HTTP server with the API available on the
same origin.

Firestore browser rules deny direct client access. Payment, patient,
appointment and treatment records are handled by the backend. Newly paid
appointments appear in the admin dashboard; the patient receives a Patient ID
and one-time PIN on the payment confirmation page.

## Deploying the frontend and API on Render

Create a Render **Web Service** from the `backend` directory and a Render
**Static Site** for the frontend from the repository root. The API service
needs the same Firestore project as the local backend. Configure its required
environment variables in the Render dashboard; never commit credentials:

- `NODE_ENV=production`
- `PORT=10000` (or use Render's automatically provided `PORT`)
- `FIREBASE_PROJECT_ID=dr-vishal-clinic`
- `GOOGLE_APPLICATION_CREDENTIALS` set either to the path of a Render Secret
  File containing the service-account JSON or to the JSON content itself. For
  a Secret File, use its mounted path (for example
  `/etc/secrets/firebase-service-account.json`). Never commit or share the
  JSON key.
- `JWT_SECRET`, `ADMIN_PASSWORD`, and the intended Razorpay key pair
- `FRONTEND_ORIGINS` set to the exact public origin(s) of the frontend, as a
  comma-separated list, for example `https://your-frontend.onrender.com`

Set the `api-base-url` meta tag in both `patient-dashboard.html` and
`admin-dashboard.html` to the API Web Service's public origin, for example
`https://your-api.onrender.com`. Do not add a trailing slash. This is needed
because the frontend and API are separate Render services; Firebase Hosting's
`/api/**` rewrite does not apply on Render.

After both services deploy, verify `https://your-api.onrender.com/api/health`,
then test patient login using a Patient ID and PIN that exist in the same
Firestore project. A patient created only in a different local or cloud
Firestore project will not be recognized by this API.
