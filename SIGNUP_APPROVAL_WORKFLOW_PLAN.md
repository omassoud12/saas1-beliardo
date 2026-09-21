# Signup, Email Confirmation, and Admin Approval Workflow Plan

## Goal

Create a clear onboarding journey for new lounge owners so that every successful action moves the user to a distinct page and the registration form cannot be submitted repeatedly by mistake.

The intended journey is:

```text
Create account
    -> Check your email
    -> Confirm email
    -> Waiting for approval
    -> Return to landing page
    -> Check approval
    -> Open dashboard when approved
```

This work should preserve the existing separation between:

- Supabase authentication: account creation, password, session, and email confirmation.
- Application authorization: platform-admin approval and access to a lounge.

## Agreed User Experience

### 1. Account registration

The visitor opens the registration page and submits the lounge name, email, and password.

While the request is running:

- Disable the submit button.
- Display a progress state.
- Prevent duplicate submissions.

When Supabase successfully creates an account that requires email confirmation:

- Stop displaying the registration form.
- Navigate to `/check-email`.
- Show the email address to which the confirmation was sent, preferably partially masked when appropriate.

Do not leave writable registration fields or an active **Create Account** button on the success screen.

### 2. Check Your Email page

The page should communicate that registration succeeded and that email confirmation is the next required step.

Suggested content:

- Title: **Check your email**
- Explanation: A confirmation link was sent to the submitted address.
- Explanation that admin approval will be required after email confirmation.
- **Resend confirmation email** action with a cooldown to prevent repeated sends and provider rate limits.
- **Use a different email** action that returns to registration.
- **Go to sign in** action for users who already confirmed their address.

Refreshing `/check-email` should continue to show a meaningful page. If the submitted email is no longer available in local state, the page should use generic copy instead of redirecting unexpectedly or exposing account information.

### 3. Email-confirmation callback

The Supabase confirmation link should return to a deliberate application destination, such as `/auth/callback` or `/app`, rather than relying accidentally on the site root.

At the callback:

1. Allow Supabase to exchange or restore the authenticated session.
2. Request the user's current application access state from the backend.
3. Route according to that state.

For a newly confirmed owner, the expected state is `pending_approval`, so the destination should be `/pending-approval`.

The callback should also handle invalid, expired, or already-used confirmation links with clear recovery actions.

### 4. Waiting for Approval page

After confirmation, display a dedicated page stating that:

- The email has been confirmed successfully.
- The lounge account is waiting for platform-admin approval.
- The user does not need to create another account.
- The user may safely leave or close the page.

Suggested actions:

- **Check approval status**
- **Return to home** or **Return to landing page**
- **Sign out**
- Optional **Contact support** action

The page should check for updated access:

- When the user presses **Check approval status**.
- When the browser tab becomes active again.
- Optionally every 15–30 seconds while the page remains open.

If the account becomes approved, route directly to the dashboard without requiring a manual browser refresh.

### 5. Landing-page account button

The landing page's primary account action should reflect the authenticated user's application status.

| User state | Button label | Action |
| --- | --- | --- |
| No authenticated session | **Create Your Account** | Open `/register` |
| Authenticated and `pending_email` | **Confirm Your Email** | Open `/check-email` |
| Authenticated and `pending_approval` | **Check Approval** | Fetch the latest status and open the pending page if it remains pending |
| `approved_owner` or `active_employee` | **Open Dashboard** | Open `/app` |
| `rejected`, `suspended`, `disabled`, `deleted`, or `no_access` | Status-specific action | Open the corresponding account-state page |

For the agreed owner-registration flow, the important transition is:

```text
Pending approval: Check Approval
Approved:         Open Dashboard
```

The landing page must not treat the existence of a Supabase session as proof that dashboard access has been approved. It must use the backend access state.

When **Check Approval** is pressed:

1. Fetch the latest access state.
2. If it is still `pending_approval`, open or retain `/pending-approval`.
3. If it is `approved_owner`, open `/app`.
4. If it changed to another state, show the appropriate account-state page.

## Routing and State Rules

Use explicit destinations, even if the application implements them using its current lightweight history-based router rather than adding a routing library.

| Route | Purpose | Expected access |
| --- | --- | --- |
| `/register` | Owner registration form | Signed-out visitor |
| `/check-email` | Registration-success and email-confirmation instructions | Usually signed out or `pending_email` |
| `/auth/callback` | Supabase email-link processing | Temporary callback destination |
| `/pending-approval` | Confirmed account awaiting review | Authenticated `pending_approval` user |
| `/app` | Protected application entry | Approved owner or active employee |

Routing decisions must come from authoritative state:

- Use the Supabase session to establish authentication.
- Use `fetchMyAccess()` to establish application authorization.
- Do not unlock the dashboard based only on frontend memory, URL values, or the presence of a session.

## Account-State Mapping

Preserve the existing account states and give each one a deterministic destination:

| Backend state | Destination or screen |
| --- | --- |
| `pending_email` | Check Your Email |
| `pending_approval` | Waiting for Approval |
| `approved_owner` | Owner dashboard |
| `active_employee` | Employee application |
| `password_setup_required` | Password setup |
| `rejected` | Registration Rejected |
| `suspended` | Account Suspended |
| `disabled` | Employee Access Disabled |
| `deleted` | Account Unavailable |
| `no_access` | No Active Lounge Access |
| `platform_admin` | Platform administration |

## Cross-Tab Behavior

The registration page and email-confirmation link may be open in different browser tabs.

Plan for the original tab to respond to Supabase authentication changes:

- After signup, the original tab remains on the Check Your Email screen, never on an active registration form.
- If confirmation in another tab creates a shared session, the original tab should detect the auth change and resolve the latest access state.
- A confirmed owner should then move from Check Your Email to Waiting for Approval.
- Approval detected in either tab should lead to the dashboard on the next explicit check, focus event, or polling interval.

## Error and Recovery Cases

Handle these cases without returning the user to an ambiguous registration form:

- Email already registered: provide a sign-in or password-reset path.
- Confirmation email delayed: allow a rate-limited resend.
- Confirmation link expired: explain the problem and offer a new confirmation email.
- Confirmation link already used: attempt to restore/check the session, then offer sign-in if necessary.
- User opens `/pending-approval` while signed out: send them to sign in, then return to the correct account-state page.
- Admin rejects the registration: show the Registration Rejected state, not Waiting for Approval.
- Session expires on the landing or pending page: change the CTA to sign in/create account as appropriate.
- Network failure while checking approval: keep the user on the current safe page and show a retryable error.
- Duplicate Create Account click: only one submission should be allowed while the first request is in progress.

## Likely Frontend Areas to Update Later

Implementation will likely touch these existing responsibilities:

- `frontend/src/components/AuthGate.jsx`
  - Replace the post-signup inline message with navigation to the Check Your Email state.
  - Ensure the completed form cannot be resubmitted.
- `frontend/src/components/AccountState.jsx`
  - Separate and strengthen the pending-approval experience and its actions.
- `frontend/src/public/PublicRouter.jsx`
  - Recognize the new explicit routes and callback destination.
- `frontend/src/public/LandingPage.jsx`
  - Make the primary account button depend on application access state rather than session presence alone.
- `frontend/src/App.jsx`
  - Centralize or reuse access-state routing so landing, callback, and protected application entry behave consistently.
- Supabase Auth redirect configuration
  - Allow the production and development callback URLs used by confirmation emails.

The backend account-state model already supports the intended workflow. Backend changes should only be introduced if implementation discovers that the confirmation transition or access response does not reliably expose the necessary state.

## Implementation Sequence

1. Define route constants for Check Your Email, auth callback, Waiting for Approval, and application entry.
2. Extract or centralize the mapping from access state to destination.
3. Change successful registration to enter the Check Your Email state and remove the form.
4. Add the Check Your Email screen and recovery actions.
5. Configure and handle the Supabase confirmation callback.
6. Add the dedicated Waiting for Approval screen and status refresh behavior.
7. Make the landing-page CTA use the backend access state.
8. Add cross-tab/session-change handling.
9. Add automated tests for routing, button labels, transitions, and failure states.
10. Verify the complete workflow against a disposable pending owner and platform-admin account.

## Acceptance Criteria

- A successful registration never leaves an active Create Account form on screen.
- The user is taken to a clear Check Your Email page after registration.
- The confirmation link leads to a valid application callback.
- A confirmed but unapproved owner sees Waiting for Approval.
- Waiting for Approval includes a route back to the landing page.
- The landing-page button says **Check Approval** for a pending owner.
- Pressing **Check Approval** fetches fresh backend state.
- The button says **Open Dashboard** after approval.
- An approved user can enter the dashboard without registering or confirming again.
- Approval can be detected without manually refreshing the entire browser page.
- Rejected, suspended, disabled, deleted, and unauthenticated users receive the correct safe experience.
- The dashboard remains protected by backend authorization regardless of frontend navigation.

## Testing Checklist

### Automated tests

- Successful signup routes to `/check-email`.
- The signup form is absent after successful submission.
- Failed signup retains the form and displays the correct error.
- Pending-email, pending-approval, approved, and restricted states map to the correct screen.
- Landing CTA labels and destinations match each access state.
- Check Approval performs a new access request rather than using stale state.
- Approval causes navigation to `/app`.
- Session changes in another tab trigger state resolution.
- Network errors do not incorrectly grant access or erase the current state.

### Manual end-to-end verification

1. Register a new owner.
2. Confirm that the browser shows Check Your Email and cannot resubmit the form.
3. Open the email link in a second tab.
4. Confirm that the second tab shows Waiting for Approval.
5. Return to the landing page and confirm the CTA says Check Approval.
6. Press Check Approval before approval and confirm the pending page remains correct.
7. Approve the account using the platform-admin interface.
8. Press Check Approval again, or wait for the pending-page refresh.
9. Confirm that the CTA becomes Open Dashboard and the dashboard opens.
10. Repeat relevant checks for rejected and expired-session outcomes.

## Out of Scope for This Plan

- Changing the platform-admin approval policy.
- Automatically approving owner accounts.
- Replacing Supabase authentication.
- Redesigning employee invitation onboarding, except where shared routing must continue to support it.
- Implementing the changes described above; this document is planning only.
