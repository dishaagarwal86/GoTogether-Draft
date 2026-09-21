# GoTogether API

Install and run the API:

```sh
cd server
npm install
npm run dev
```

Available endpoints:

- `GET /api/health`
- `GET /api/rooms`
- `POST /api/rooms` with `{ "name": "…", "tripName": "…", "members": 2 }`

Room data is currently stored in memory and resets when the server restarts. Replace `roomService.ts` with a database adapter when persistence is needed.
