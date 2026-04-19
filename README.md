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

- Multi-page frontend in HTML/CSS/JavaScript.
- Node.js + Express backend API.
- MongoDB for persistent data storage.
- JWT-based authentication with OTP email verification.
- Shared memories are synchronized in frontend pages and can be persisted through backend APIs.
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

## Authentication API

Base path: `/api/auth`

- `POST /register`
	- Body: `{ "name": "...", "email": "u1234567@student.cuet.ac.bd", "password": "..." }`
	- Validates strict CUET student email format.
	- Hashes password with bcrypt.
	- Creates user as unverified and sends a 6-digit OTP by email.

- `POST /verify-otp`
	- Body: `{ "email": "u1234567@student.cuet.ac.bd", "otp": "123456" }`
	- Verifies OTP, sets `isVerified=true`, and removes OTP.

- `POST /login`
	- Body: `{ "email": "u1234567@student.cuet.ac.bd", "password": "..." }`
	- Allows only verified users.
	- Returns JWT token on success.

- `GET /me`
	- Header: `Authorization: Bearer <token>`
	- Returns authenticated user profile.

## Environment variables

Use `.env.example` as a template.

Required for auth:

- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default `7d`)
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM` (optional)

## Status

This is a functional MVP with backend APIs, persistent storage, and production-style authentication building blocks.
