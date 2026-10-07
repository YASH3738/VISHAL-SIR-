# Netlify and Firebase configuration

The production website and payment API are hosted together on Netlify: static pages are published from the repository root and `functions/netlify/api.js` runs as a Netlify Function. There is no separately hosted backend server. The Netlify Function uses Firebase Admin to write verified appointments to the existing `dr-vishal-clinic` Firestore database; the admin dashboard reads those same records from `appointment_bookings` and `payments` using Firebase client SDK and its existing security rules.

## One-time setup

1. In Firebase Console, enable Firestore and Authentication → Email/Password, then create the clinic administrator account and assign its existing `admin: true` custom claim.
2. Create a Firebase service account for the Netlify Function. Grant only the permissions needed to access Firestore and Firebase Authentication, and enable service-account token creation if the function's Firebase custom-token login requires it. Keep the complete service-account JSON private.
3. In Netlify site settings → Environment variables, configure these **Functions-only** variables:

   - `GOOGLE_APPLICATION_CREDENTIALS`: complete Firebase service-account JSON as one JSON value
   - `FIREBASE_PROJECT_ID`: `dr-vishal-clinic`
   - `RAZORPAY_KEY_ID`: Razorpay Key ID
   - `RAZORPAY_KEY_SECRET`: Razorpay Secret Key
   - `RAZORPAY_WEBHOOK_SECRET`: webhook signing secret
   - `PIN_ENCRYPTION_KEY`: base64 encoding of exactly 32 random bytes

   Generate a PIN encryption key locally with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Set values in Netlify's UI or its encrypted environment configuration, never in frontend files or committed files. Scope the values to Functions; especially never prefix the Razorpay secret with a client-exposure prefix.
4. In Razorpay settings, configure the webhook URL as `https://vishalyogi.in/api/razorpay/webhook` and set the matching secret as `RAZORPAY_WEBHOOK_SECRET`.

## Deploy

From the repository root, deploy the existing Netlify site. The configured Netlify build command installs the dependencies in `functions/package.json` and runs syntax checks before publishing. No Firebase HTTPS Function or separate backend host is deployed.

```powershell
netlify deploy --prod
```

Deploy the site from Netlify (or run `netlify deploy --prod` from the repository root after installing the Netlify CLI). Verify the Netlify Function directly:

```powershell
Invoke-RestMethod https://vishalyogi.in/.netlify/functions/api/api/health
```

Then verify the public proxy:

```powershell
Invoke-RestMethod https://vishalyogi.in/api/health
```

Both requests should return JSON with `success: true`, not an HTML 404 page. The appointment form posts JSON to `https://vishalyogi.in/api/appointment/payment-order`; payment confirmation posts to `/api/appointment/payment-complete`.

## Appointment dashboard flow

The order endpoint first creates a pending document in `appointment_bookings`; the dashboard may show it as “Awaiting payment.” After Checkout, `/api/appointment/payment-complete` verifies the Razorpay signature and fetches the payment from Razorpay, requiring `status: captured`, the expected order, amount, and currency. Only then does the existing Firestore transaction create a paid/confirmed document in `appointments`, update the same `appointment_bookings` document to `payment_status: paid`, update `payments` to `status: paid`, and confirm the slot reservation. The admin dashboard's `loadBookings()` reads `appointment_bookings`; `loadRevenue()` reads paid `payments`. Both read the same Firebase project the Netlify function writes to. Merely opening Checkout never marks the appointment as paid or confirmed.

## Current behavior and security

- Appointment booking, availability, Razorpay order creation, payment confirmation, webhook processing, and patient PIN login use Netlify's `/api/*` rewrite to the Netlify Function.
- On successful verification the function creates a paid appointment in `appointments`, updates the corresponding `appointment_bookings` document and payment record, and reserves the slot in Firestore. The admin dashboard reads `appointment_bookings` and `payments` from the same Firebase project, so confirmed bookings and revenue appear there.
- The Razorpay Key ID is returned to Checkout; the Razorpay Secret Key, webhook secret, Firebase service-account JSON, and PIN encryption key remain server-side Netlify Function environment variables.
- Patient PINs are generated and hashed in the Function. The hash is never client-readable. A new PIN is delivered only once after payment verification.
- Patients authenticate with Patient ID + PIN through the Function and then receive a Firebase custom-token session scoped to their own patient records.
- Admins sign in with Firebase Authentication and must have the `admin: true` custom claim. Admin data reads and treatment updates are authorized by Firestore rules.
- No automated WhatsApp confirmation is sent after booking. The booking receipt no longer offers WhatsApp sharing.
- The legacy Express backend and Firebase HTTPS Function are not required for the Netlify payment deployment.

The Firebase web configuration in `firebase-config.js` contains the public web app configuration, not service-account credentials. Never put service-account JSON, Razorpay secrets, PIN encryption material, or other private credentials in frontend files.
