# TSAP Club Website

A competitive programming club website with authentication, platform integrations (Codeforces, CodeChef, LeetCode), and analytics.

## Features

-   **Unified Dashboard**: View stats from Codeforces, LeetCode, and CodeChef in one place.
-   **Leaderboard**: Club-wide ranking based on aggregated problem counts and Codeforces rating.
-   **Analytics**: Visualizations for daily activity and storage.
-   **Authentication**: Admin/Member roles.

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the server (Development Mode):
    ```bash
    npm start
    ```
    *Runs on http://localhost:3000*

## Firebase Setup (Persistence)

By default, the app runs in **Memory Mode** (users are lost on restart). To enable persistent storage:

1.  **Create a Firebase Project**:
    -   Go to [Firebase Console](https://console.firebase.google.com/).
    -   Create a new project.

2.  **Enable Database**:
    -   Go to **Build > Realtime Database**.
    -   Click **Create Database** (Start in Test Mode for development).
    -   Copy the database URL (e.g., `https://your-project-id.firebaseio.com`).

3.  **Generate Service Account**:
    -   Go to **Project Settings > Service accounts**.
    -   Click **Generate new private key**.
    -   Save the JSON file.

4.  **Configure Environment**:
    -   Open `server.js` and update the `databaseURL` in the admin initialization block (around line 13).
    -   Set the `SERVICE_ACCOUNT_KEY` environment variable with the *content* of the JSON file:

    ```bash
    # Option A: Inline (Bash)
    export SERVICE_ACCOUNT_KEY='{ "type": "service_account", ... }'
    npm start

    # Option B: Use a temporary file (easier)
    # create firebase-key.json (add to .gitignore!)
    export SERVICE_ACCOUNT_KEY=$(cat firebase-key.json)
    npm start
    ```

## API Integrations
-   **Codeforces**: Uses public API.
-   **LeetCode**: Uses GraphQL API.
-   **CodeChef**: Uses HTML scraping (brittle, may need updates).
