# NAKAMA

A personal contacts app. The Google Sheet **NAKAMA Contacts** is the master copy, a small Apps Script web app is the backend, and this page (`index.html`) is the front end, hosted on GitHub Pages.

This repo holds **no contact data**. The backend URL and the PIN are typed into the app and saved only in your browser.

## One-time setup

1. Open the **NAKAMA Contacts** sheet in Google Drive, then go to **Extensions → Apps Script**.
2. Delete the starter code, paste in everything from [`apps-script/Code.gs`](apps-script/Code.gs), and save.
3. Click **Project Settings** (the gear), then under **Script Properties** click **Add script property**. Name it `PIN` and give it a value only you know, such as a short phrase.
4. Back in the editor, pick **setup** from the function list and click **Run**. Approve the permissions it asks for. This step:
   - imports your contacts and their photos from the `nakama-import-part-*.json` files in your Drive, then moves those files to the bin
   - creates the **NAKAMA Sync Inbox** folder for the nightly Beeper sync
   - adds an hourly trigger that applies each night's sync file
5. Click **Deploy → New deployment**, choose the type **Web app**, and set **Execute as: Me** and **Who has access: Anyone**. Deploy, then copy the URL that ends in `/exec`.
   (Anyone can reach the URL, but every request is refused without the PIN.)
6. Open the NAKAMA site, click **Settings**, paste the `/exec` URL and your PIN, then click **Connect**.

## Updating the backend

After changing `Code.gs`, use **Deploy → Manage deployments → Edit → New version**. That keeps the same `/exec` URL.

The backend adds any missing sheet columns (Japanese name, Likes, Lat, Lng) and the **Dashboards** tab the first time they're needed, so no manual sheet edits are required.

## What's in the app

- **Dashboard**: drag-and-drop cards (including Favourites), card sizes, and saved dashboard views.
- **Contacts, Canvas and Map**: the Map places everyone by address; drag people from the side panel onto the map to set their address.
- **Profiles**: My notes and AI notes (Claude writes only in AI notes), Merge duplicate, Japanese name, age, Likes, Group (type to search or press Enter to create), Needs contact list, bigger photo view, and a Link chat search across Beeper chats.
- **Other tools**: Beeper matcher (when linking, choose to keep the contact's name, use the chat's name, or type a new one), Random contact, and the Photo inbox (photos live in the **NAKAMA Photo Inbox** Drive folder; crop one photo for one or many people).
- **Settings**: Connection, Canvas physics and Look tabs.
- **Syncing**: a live list of changes being sent sits under the Connected card. The first load shows a progress count.
- Works on phones in Chrome.

## Nightly Beeper sync

Each night a scheduled Claude task reads Beeper Desktop on your computer, then drops `nakama-sync-YYYY-MM-DD.json` into the **NAKAMA Sync Inbox** folder. Within the hour, the Apps Script trigger applies it:
- **Last contact** is updated for linked people, counting only messages *you* sent.
- New chats appear in the **Beeper matcher**, ready to link.
