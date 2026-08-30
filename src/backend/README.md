# Backend setup guide

This guide explains how to configure the Supabase and Discord authentication flow for Pluberry.

## 1. Supabase configuration

Create a Supabase project and configure the following values in the Supabase dashboard.

### Database table

Run `supabase_schema.sql` in Supabase Dashboard > SQL Editor. It creates the `sources` table, grants access to the `authenticated` role, and restricts each user to their own rows with RLS.

After signing in and saving a source in Pluberry, verify the rows with:

```sql
select id, user_id, name, data, inserted_at, updated_at
from public.sources
order by inserted_at desc;
```

The `data` column should contain the source URL and its JSON metadata. If the table stays empty, check Authentication > Users, the RLS policy, and the application log for the exact Supabase error.

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

## 5. Settings plugins

An enabled plugin can add a section to the Settings window with the `window.pluberrySettings` API:

```js
(function () {
  window.pluberrySettings.addSection({
    id: "my-plugin-settings",
    title: "My plugin",
    render: (section) => {
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      section.appendChild(slider);
    }
  });
})();
```

Plugin-specific values can be persisted with `getPluginSettings(pluginName)` and `savePluginSettings(pluginName, values)`. The built-in example is `src/plugins/iloverainbow.js`.
