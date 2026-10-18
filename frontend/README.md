# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Microphone monitoring

The exam room analyzes microphone levels locally and never records or uploads audio. Tune the defaults for the exam environment with these Vite variables:

- `VITE_MIC_AUDIO_THRESHOLD` sets the RMS activity threshold (default `0.08`).
- `VITE_MIC_SUSTAINED_MS` sets the required continuous duration in milliseconds (default `1500`).
- `VITE_MIC_COOLDOWN_MS` sets the warning cooldown in milliseconds (default `10000`).

These are frontend build-time settings, not secrets. Rebuild the frontend after changing them and test with the actual devices and room noise expected for the exam; detected audio is not evidence of cheating.
