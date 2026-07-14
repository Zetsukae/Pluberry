# Backend setup guide

This guide explains how to configure the Supabase and Discord authentication flow for Pluberry.

## 1. Supabase configuration

Create a Supabase project and configure the following values in the Supabase dashboard.

### Authentication settings

- Set the Site URL to:
  - http://localhost:9999
- Add the following Redirect URLs:
  - http://localhost:9999/auth/callback
  - http://127.0.0.1:9999/auth/callback

### Environment variables

Create a file named `.env` in this folder (`src/backend/.env`) and add:

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_REDIRECT_PORT=9999
SUPABASE_REDIRECT_PATH=/auth/callback
SUPABASE_REDIRECT_HOST=localhost
```

You may also optionally set:

```env
PLUBERRY_PROTOCOL=pluberry
PLUBERRY_APP_LANG=en
```

## 2. Discord OAuth configuration

In the Discord Developer Portal:

1. Create an application.
2. Go to OAuth2.
3. Add a redirect URL matching the Supabase callback:
   - http://randomnumberfromyoursupabaseURL/auth/v1/callback
4. Copy the Client ID and Client Secret.
5. In Supabase Authentication > Providers > Discord, enable Discord and enter the Discord credentials.

## 3. Run the app

From the project root:

```bash
npm install
npm start
```

When the user signs in with Discord, the app opens the OAuth flow and returns to the local callback page before finishing the sign-in.

## 4. Notes

- The app uses a local callback server on port `9999`.
- If you use a different host or port, update the environment variables accordingly.
- Keep your `.env` file private and do not commit it.
- You can use different Providers than Discord (ex: GitHub, Apple, Google, ...)
