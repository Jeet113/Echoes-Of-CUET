# Echoes-Of-CUET

Echoes Of CUET is a map-based campus storytelling web app where CUET students and alumni can share memories pinned to real campus locations.

## What this project is

This project is a front-end, multi-page web application focused on preserving campus experiences.
Users can explore memories on an interactive map, browse stories in a gallery, create accounts, post their own memories, and view their personal activity from a dashboard.

## Main features

- Interactive campus map with memory markers.
- Search and department filtering for map memories.
- Route helper between campus locations.
- Memory gallery with search.
- Share Memory flow (3 steps):
	- Pick location on map
	- Write memory details
	- Preview and submit
- Image upload support for memories.
- Local user authentication flow:
	- Login
	- Register
	- Logout
- User dashboard with profile and personal memory stats.
- Admin panel UI for moderation workflow (pending, approved, rejected sections).
- Responsive navigation for desktop and mobile.

## Current architecture

- Static HTML/CSS/JavaScript project (no backend server yet).
- State is stored in browser localStorage.
- Shared memories are synchronized across pages and tabs using:
	- localStorage
	- storage event listeners
	- custom browser events
- Google Maps JavaScript API is used for map rendering and interactions.

## Core pages

- index.html: Landing page, map experience, memory gallery, about section.
- share-memory.html: Memory creation wizard and recent shared memories.
- login.html: User login flow.
- register.html: User registration flow.
- user-dashboard.html: Logged-in user profile and memory summary.
- admin.html: Admin moderation dashboard UI.

## JavaScript modules

- js/app.js: Main page logic (map, gallery, filters, auth UI state, interactions).
- js/share-memory.js: Share Memory wizard, validation, upload, preview, submit.
- js/dashboard.js: User dashboard rendering and user-specific memory stats.
- js/memory-sync.js: Cross-page memory persistence and synchronization.

## Styling

- css/style.css: Global and main page styles.
- css/share-memory.css: Share Memory page styles.
- css/auth.css: Login and register page styles.
- css/dashboard.css: User dashboard styles.
- css/admin.css: Admin panel styles.

## Status

This is a functional MVP/prototype for campus memory sharing.

### Production notes

Before production release, the following should be added:

- Backend API and database for persistent multi-device data.
- Secure authentication and authorization.
- Server-side moderation and content validation.
- Protected secrets management for API keys.
