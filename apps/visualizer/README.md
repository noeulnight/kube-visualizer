# Kube Visualizer Frontend

React frontend for Kube Visualizer.

The app renders Kubernetes resources as a D3 force-directed graph and consumes live graph deltas from the backend SSE endpoint.

## Stack

- React 19
- Vite
- Tailwind CSS
- D3 force simulation
- Server-Sent Events

## Scripts

```bash
pnpm --filter visualizer dev
pnpm --filter visualizer lint
pnpm --filter visualizer build
pnpm --filter visualizer preview
```

## Environment

`VITE_API_URL` is optional. Leave it empty when the frontend and backend are served behind the same origin.

```bash
VITE_API_URL=http://localhost:3000 pnpm --filter visualizer dev
```

## UI

- Search resources by name or id.
- Click a node to open resource details.
- Hover a node for compact metadata.
- Drag nodes without panning the canvas.
- Filter by resource type and edge type.
- Use the mobile bottom filter toggle on narrow screens.

## SEO Metadata

Static title, description, Open Graph, Twitter, robots, theme color, and favicon metadata live in `index.html`.
