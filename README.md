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

### Team room (fixed room, no create step)

Teams that meet regularly can skip creating a room. The server has a short list of **team rooms** with fixed IDs (see `TEAM_ROOMS` at the top of `server/server.js`; the default is `MOJITO`):

- Nobody creates a team room. Whoever opens it first, by entering their name and `MOJITO` as the Room ID, brings it to life. The same happens after a server restart, so there is no waiting for the Scrum Master to reconnect.
- The **Scrum Master is elected by name**, not by who arrived first. For `MOJITO` the priority is: a member whose name starts with `Las`, otherwise one whose name starts with `Jul`, otherwise the current SM, otherwise the earliest member. The role moves automatically as people join or leave.
- Once you have joined a team room, your browser remembers it (name and room ID in localStorage). The **next time you open the app you join it automatically** without seeing the home page.
- To get back to the home page, click **Leave**. The form comes prefilled; you can change your name, join another room, or create a new one. Auto-join stays off for that tab until you close it.
- To stop being remembered, click **Forget team room** on the home page.

### Voting

- Each participant picks a card from the row at the bottom of the screen (Fibonacci sequence + `?` and `☕`).
- Your selected card lifts and turns purple — click a different card to change your vote.
- The sidebar shows who has voted (✓) and who hasn't (…).
- Votes are hidden until the Scrum Master flips the cards.

### Scrum Master controls

Only the Scrum Master has these buttons (the room creator, or in a team room the elected member):

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
