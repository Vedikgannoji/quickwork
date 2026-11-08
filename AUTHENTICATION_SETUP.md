# QuickWork Authentication Setup Guide

This document explains how to configure real Supabase authentication for QuickWork.

## Overview

QuickWork now uses **real Supabase authentication** instead of mock authentication. The app supports:

- ✅ Email + OTP (Magic Link)
- ✅ Phone + SMS OTP
- ✅ Google OAuth

## Prerequisites

1. A Supabase project (create one at https://supabase.com)
2. `.env.local` file configured with Supabase credentials

## Basic Setup

### 1. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

Get these values from:
- Supabase Dashboard → Settings → API
- Project URL → `VITE_SUPABASE_URL`
- anon public key → `VITE_SUPABASE_ANON_KEY`

### 2. Run Database Migrations

Apply the database schema:

```bash
# Make sure you have Supabase CLI installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
npm run db:push
```

This creates the required tables:
- `profiles` - User profiles with name, phone, location
- `jobs` - Job listings
- `job_categories` - Role categories within jobs
- `job_positions` - Individual bookable positions
- `applications` - Worker applications

## Email Authentication

Email authentication works out of the box with Supabase's default settings.

**How it works:**
1. User enters their email
2. System sends OTP to email
3. User enters OTP to verify
4. Profile is created automatically

**Configuration:**
- Go to Supabase Dashboard → Authentication → Settings
- Confirm "Enable Email Provider" is checked
- Customize email templates if desired

## Phone Authentication (SMS OTP)

Phone authentication requires configuring an SMS provider.

### Setup Steps

1. **Choose an SMS Provider**
   - Twilio (recommended)
   - MessageBird
   - Vonage
   - TextLocal

2. **Configure in Supabase**
   - Go to Supabase Dashboard → Authentication → Providers
   - Click "Phone"
   - Enable the provider
   - Enter your SMS provider credentials

3. **Twilio Setup Example**
   ```
   Provider: Twilio
   Account SID: AC...
   Auth Token: ...
   Sender: +1234567890
   ```

4. **Test**
   - Enter phone number with country code (e.g., +919876543210)
   - OTP should arrive via SMS
   - Enter OTP to verify

## Google OAuth

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen
6. Create OAuth Client ID:
   - Application type: Web application
   - Authorized JavaScript origins:
     - `http://localhost:8080` (development)
     - `https://your-domain.com` (production)
   - Authorized redirect URIs:
     - `https://your-project-ref.supabase.co/auth/v1/callback`
     - `http://localhost:8080/auth-callback` (development)

### 2. Configure in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Google"
3. Enter:
   - Client ID (from Google Console)
   - Client Secret (from Google Console)
4. Save

### 3. Test

- Click "Sign in with Google" button
- You'll be redirected to Google's consent screen
- After approval, you're redirected back to `/auth/callback`
- Profile is created automatically

## Authentication Flow

### New User Flow

1. User clicks "Sign In"
2. Chooses authentication method (Email/Phone/Google)
3. Completes verification (OTP or OAuth)
4. Supabase creates user in `auth.users`
5. Trigger creates profile in `profiles` table
6. User redirected to `/complete-profile`
7. User fills in name, location, etc.
8. Profile marked as complete
9. User redirected to dashboard

### Returning User Flow

1. User signs in with same method
2. Supabase recognizes existing user
3. Profile fetched from database
4. User goes directly to dashboard (profile already complete)

## Session Management

Sessions are managed automatically:

- **Persistence**: Sessions persist across page refreshes (localStorage)
- **Auto-refresh**: Access tokens refresh automatically before expiry
- **Cross-tab sync**: Sign in/out syncs across browser tabs
- **Secure**: Tokens stored securely, never in URLs

## Security Features

✅ **Row Level Security (RLS)**
- Users can only read/update their own profile
- Employers can only manage their own jobs
- Workers can only see applications they're part of

✅ **Secure Functions**
- All booking operations use `SECURITY DEFINER` RPCs
- Server-side validation prevents tampering
- No client-side user ID injection

✅ **Protected Routes**
- Unauthenticated users redirected to login
- Incomplete profiles redirected to setup

## Troubleshooting

### "Supabase not configured" error

**Problem**: Missing environment variables  
**Solution**: Create `.env.local` with Supabase credentials, restart dev server

### Phone OTP not arriving

**Problem**: SMS provider not configured  
**Solution**: Configure SMS provider in Supabase Dashboard → Authentication → Providers → Phone

### Google OAuth redirect fails

**Problem**: Redirect URI not authorized  
**Solution**: Add `https://your-project-ref.supabase.co/auth/v1/callback` to Google Console

### "Profile not found" error

**Problem**: Trigger not creating profile  
**Solution**: Check migration `20261001000000_initial_schema.sql` applied successfully

### Session not persisting

**Problem**: Browser blocks localStorage  
**Solution**: Check browser privacy settings, disable "Block all cookies"

## Development vs Production

### Development (localhost)

```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Redirect URLs:
- `http://localhost:8080/auth-callback`

### Production (Vercel/Netlify)

Environment variables:
- Set in deployment platform settings
- Mark `SUPABASE_SERVICE_ROLE_KEY` as server-only

Redirect URLs:
- `https://your-domain.com/auth-callback`
- Configure in Google Console
- Configure in Supabase settings

## Testing Authentication

### Manual Test Checklist

- [ ] Email OTP sends successfully
- [ ] Email OTP verification works
- [ ] Phone OTP sends successfully
- [ ] Phone OTP verification works
- [ ] Google OAuth redirects correctly
- [ ] Google OAuth callback works
- [ ] New users create profile
- [ ] Profile completion flow works
- [ ] Returning users skip profile setup
- [ ] Logout works
- [ ] Session persists after refresh
- [ ] Protected routes redirect to login

### Test Users

Create test users via Supabase Dashboard:
- Dashboard → Authentication → Users → Add User
- Useful for testing without SMS costs

## Migration from Mock Auth

If upgrading from mock authentication:

1. ✅ All mock functions removed
2. ✅ Real Supabase auth integrated
3. ✅ Session management added
4. ✅ Profile fetching from database
5. ✅ OAuth callback route created

**No data migration needed** - mock auth never persisted to database.

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [OAuth Providers Setup](https://supabase.com/docs/guides/auth/social-login)
- [Phone Auth Setup](https://supabase.com/docs/guides/auth/phone-login)

## Support

For issues:
1. Check Supabase logs: Dashboard → Logs → Auth
2. Check browser console for errors
3. Verify environment variables are set
4. Confirm database migrations applied
