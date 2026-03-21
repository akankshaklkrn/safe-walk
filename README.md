# SafeWalk

AI-powered walking safety companion mobile app.

## Tech Stack
- React Native
- Expo
- TypeScript
- Expo Router

## Project Structure
```
SafeWalk/
├── app/                    # Screens (Expo Router)
│   ├── _layout.tsx        # Root navigation layout
│   ├── index.tsx          # Home screen
│   ├── route-selection.tsx # Route selection screen
│   └── active-trip.tsx    # Active trip screen
├── components/            # Reusable components
├── constants/             # App constants
│   └── colors.ts         # Color palette
├── types/                # TypeScript types
│   └── index.ts          # Type definitions
└── data/                 # Mock data
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on platform:
```bash
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

## Development Progress

### ✅ Milestone 1: Project Setup + Home Screen
- [x] Initialize Expo project with TypeScript
- [x] Set up Expo Router navigation
- [x] Create HomeScreen with destination input
- [x] Basic folder structure

### 🔄 Milestone 2: Route Selection Screen (Next)
- [ ] RouteCard component
- [ ] Mock route data
- [ ] Route selection UI

### 📋 Future Milestones
- Milestone 3: Active Trip Screen (Basic)
- Milestone 4: AI Companion Panel
- Milestone 5: Check-in Modal + Status Changes
- Milestone 6: Escalation Alert
- Milestone 7: Trip Complete Screen
- Milestone 8: Polish & Refinement
