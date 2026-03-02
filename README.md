# Planning Poker

A real-time planning poker app for agile teams. Run it locally — no accounts, no sign-up, no data stored anywhere.

## How to run

**Prerequisites:** Node.js 18+

```bash
# Install dependencies (first time only)
npm install
cd server && npm install && cd ..

# Start the server
npm run server
```

Open **http://localhost:3000** in your browser.

---

## How to play

### Starting a session

1. Open the app in your browser.
2. Enter your name.
3. Click **Create new room** — you become the **Scrum Master** for this room.
4. Share the **Room ID** (shown in the top bar) with your team.

### Joining a room

1. Open the app in your browser.
2. Enter your name and the Room ID shared by the Scrum Master.
3. Click **Join room**.

### Voting

- Each participant picks a card from the row at the bottom of the screen (Fibonacci sequence + `?` and `☕`).
- Your selected card lifts and turns purple — click a different card to change your vote.
- The sidebar shows who has voted (✓) and who hasn't (…).
- Votes are hidden until the Scrum Master flips the cards.

### Scrum Master controls

Only the person who created the room has these buttons:

| Button | When active | What it does |
|---|---|---|
| **Flip Cards** | All participants have voted | Reveals everyone's votes and shows the average |
| **New Round** | Any time | Hides votes and resets the board for the next story |

### Results

After cards are flipped:
- Each participant's card is shown face-up.
- The **average** of all numeric votes is displayed (`?` and `☕` are excluded from the average).

### Leaving

Click **Leave** in the top-right corner to exit the room.
If the Scrum Master leaves, the SM role is automatically passed to the next participant.

---

## Development mode

To get live reload while editing the frontend:

```bash
# Terminal 1 — backend
npm run server

# Terminal 2 — frontend dev server (proxies socket traffic to the backend)
npm start
```

Then open **http://localhost:4200**.

## Building for production

```bash
npm run build
# Output: dist/planning-poker/
# The server automatically serves this folder on port 3000
```
