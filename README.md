# NAKAMA

A personal contacts app. The Google Sheet **NAKAMA Contacts** is the master copy, a small Apps Script web app is the backend, and this page (`index.html`) is the front end, hosted on GitHub Pages.

This repo holds **no contact data**. The backend URL and the PIN are typed into the app and saved only in your browser.

## One-time setup

1. Open the **NAKAMA Contacts** sheet in Google Drive, then go to **Extensions → Apps Script**.
2. Delete the starter code, paste in everything from [`apps-script/Code.gs`](apps-script/Code.gs), and save.
3. Click **Project Settings** (the gear), then under **Script Properties** click **Add script property**. Name it `PIN` and give it a value only you know, such as a short phrase.
4. Back in the editor, pick **setup** from the function list and click **Run**. Approve the permissions it asks for. This step:
   - imports your contacts from the `nakama-import-part-*.json` files in your Drive, then moves those files to the bin
   - creates the **NAKAMA Sync Inbox** folder for the nightly Beeper sync
   - adds an hourly trigger that applies each night's sync file
5. Click **Deploy → New deployment**, choose the type **Web app**, and set **Execute as: Me** and **Who has access: Anyone**. Deploy, then copy the URL that ends in `/exec`.
   (Anyone can reach the URL, but every request is refused without the PIN.)
6. Open the NAKAMA site, click **Settings**, paste the `/exec` URL and your PIN, then click **Connect**.
7. To add the profile photos from Obsidian, go to **Other → Import from Obsidian → Import photos** and choose `nakama-photos.json` from your Contacts folder on the Desktop.

## Updating the backend

After changing `Code.gs`, use **Deploy → Manage deployments → Edit → New version**. That keeps the same `/exec` URL.

## Nightly Beeper sync

Each night a scheduled Claude task reads Beeper Desktop on your computer, then drops `nakama-sync-YYYY-MM-DD.json` into the **NAKAMA Sync Inbox** folder. Within the hour, the Apps Script trigger applies it:
- **Last contact** is updated for linked people, counting only messages *you* sent.
- New chats appear in the **Beeper matcher**, ready to link.
