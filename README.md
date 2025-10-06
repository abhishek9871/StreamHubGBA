# SteamHub

SteamHub is a modern, bug-free streaming web application that aggregates movie and TV show content. It uses the TMDB API for rich metadata and vidsrc.cc for streaming links, providing a seamless and enjoyable viewing experience.

## Features

- **Trending & Popular Content:** Discover trending, popular, and top-rated movies and TV shows on the home page.
- **Advanced Search:** Easily search for any movie or TV show.
- **Detailed Information:** View comprehensive details for each title, including overview, genres, cast, runtime, and similar content.
- **Watchlist:** Add movies and TV shows to your personal watchlist to keep track of what you want to watch.
- **Episode Tracking:** Mark individual TV show episodes as watched to track your progress.
- **Seamless Streaming:** Watch content directly in the app with an embedded player.
- **Responsive Design:** Enjoy a great user experience on any device, from desktops to mobile phones.
- **Persistent Data:** Your watchlist and watched history are saved in your browser's local storage.

## Installation

To get a local copy up and running, follow these simple steps.

### Prerequisites

You need a modern web browser and a code editor. This project is built as a static web application and can be served from any simple HTTP server.

### Setup

1.  **Clone the repo**
    ```sh
    git clone https://github.com/your_username/steamhub.git
    ```
2.  **Navigate to the project directory**
    ```sh
    cd steamhub
    ```
3.  **Install dependencies**
    This project uses ES modules and imports dependencies from a CDN (`esm.sh`), so there's no `npm install` step required for the base setup.

## Environment Variables

The application requires an API key from The Movie Database (TMDB).

1.  Get a free API key at [https://www.themoviedb.org/signup](https://www.themoviedb.org/signup).
2.  Create a file named `.env` in the root of your project.
3.  Add your TMDB API key to the `.env` file:

    ```
    REACT_APP_TMDB_API_KEY=your_tmdb_api_key_here
    ```

> **Note:** The application has a fallback key for demonstration purposes, but it is highly recommended to use your own.

## How to Run

You can run this project using any local static server. A popular choice is `serve`.

1.  **Install `serve` globally (if you haven't already)**
    ```sh
    npm install -g serve
    ```
2.  **Serve the project from the root directory**
    ```sh
    serve .
    ```
3.  Open your browser and navigate to the local URL provided by `serve` (e.g., `http://localhost:3000`).

## Project Structure

```
/
├── src/
│   ├── components/
│   │   ├── common/         # Reusable components (Button, Loader, etc.)
│   │   ├── layout/         # Layout components (Header, AppLayout)
│   │   └── pages/          # Page components for each route
│   ├── context/            # React Context providers (Watchlist, WatchedEpisodes)
│   ├── hooks/              # Custom hooks (useLocalStorage)
│   ├── services/           # API service modules (tmdb, vidsrc)
│   ├── utils/              # Utility functions and constants
│   ├── types.ts            # TypeScript type definitions
│   └── App.tsx             # Main application component with routing
├── index.html              # Main HTML file
├── index.tsx               # Entry point for React application
└── README.md
```